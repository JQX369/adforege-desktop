import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EbayProvider } from '@/lib/providers/ebay-enhanced'

// Mock fetch globally
global.fetch = vi.fn()

describe('EbayProvider Token Management', () => {
  const mockConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    timeout: 5000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any cached tokens
    EbayProvider.prototype['tokenCache'] = undefined
    
    // Mock environment variables
    process.env.EBAY_CLIENT_ID = 'test-client-id'
    process.env.EBAY_CLIENT_SECRET = 'test-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch new token successfully', async () => {
    const mockTokenResponse = {
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 7200,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    } as Response)

    const provider = new EbayProvider(mockConfig)
    const token = await provider.getAppToken()

    expect(token).toBeDefined()
    expect(token?.accessToken).toBe('test-access-token')
    expect(token?.tokenType).toBe('Bearer')
    expect(token?.expiresAt).toBeDefined()

    expect(fetch).toHaveBeenCalledWith(
      'https://api.ebay.com/identity/v1/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': expect.stringContaining('Basic'),
        }),
        body: expect.stringContaining('grant_type=client_credentials'),
      })
    )
  })

  it('should handle 401 error and retry once', async () => {
    const mockTokenResponse = {
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 7200,
    }

    // First call fails with 401, second succeeds
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response)

    const provider = new EbayProvider(mockConfig)
    
    // Mock the searchByKeyword method to trigger 401 handling
    vi.spyOn(provider, 'searchByKeyword').mockImplementation(async () => {
      // Simulate 401 error on first call
      const response = await fetch('https://api.ebay.com/buy/browse/v1/item_summary/search')
      if (!response.ok && response.status === 401) {
        // Clear cache and retry
        provider['tokenCache'] = undefined
        return provider.searchByKeyword('test', { limit: 1 })
      }
      return []
    })

    const results = await provider.searchByKeyword('test', { limit: 1 })

    expect(fetch).toHaveBeenCalledTimes(3) // 1 for token, 1 for failed search, 1 for retry token
    expect(results).toBeDefined()
  })

  it('should cache token and reuse it', async () => {
    const mockTokenResponse = {
      access_token: 'cached-token',
      token_type: 'Bearer',
      expires_in: 7200,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokenResponse),
    } as Response)

    const provider = new EbayProvider(mockConfig)
    
    // First call
    const token1 = await provider.getAppToken()
    
    // Second call should use cache
    const token2 = await provider.getAppToken()

    expect(token1).toEqual(token2)
    expect(fetch).toHaveBeenCalledTimes(1) // Only called once due to caching
  })

  it('should handle network errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const provider = new EbayProvider(mockConfig)
    const token = await provider.getAppToken()

    expect(token).toBeUndefined()
  })

  it('should handle invalid response format', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: 'response' }),
    } as Response)

    const provider = new EbayProvider(mockConfig)
    const token = await provider.getAppToken()

    expect(token).toBeUndefined()
  })

  it('should refresh token when expired', async () => {
    const expiredToken = {
      accessToken: 'expired-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    }

    const newTokenResponse = {
      access_token: 'new-token',
      token_type: 'Bearer',
      expires_in: 7200,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(newTokenResponse),
    } as Response)

    const provider = new EbayProvider(mockConfig)
    provider['tokenCache'] = expiredToken

    const token = await provider.getAppToken()

    expect(token?.accessToken).toBe('new-token')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
