import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EbayProvider } from '@/src/lib/clients/ebay-enhanced'

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
    // Mock environment variables
    process.env.EBAY_CLIENT_ID = 'test-client-id'
    process.env.EBAY_CLIENT_SECRET = 'test-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch new token successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 7200,
        }),
    } as Response)
    const provider = new EbayProvider(mockConfig)
    const token = await provider.getAppToken()
    expect(token?.accessToken).toBe('test-access-token')
  })

  it('should handle 401 error and retry once', async () => {
    // First search fails 401, token fetch ok, second search ok
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ itemSummaries: [] }),
      } as Response)

    const provider = new EbayProvider(mockConfig)
    try {
      await (provider as any)['fetchWithRetry'](
        'https://api.ebay.com/buy/browse/v1/item_summary/search'
      )
    } catch {}

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should cache token and reuse it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'cached-token',
          token_type: 'Bearer',
          expires_in: 7200,
        }),
    } as Response)
    const provider = new EbayProvider(mockConfig)
    const token1 = await provider.getAppToken()
    const token2 = await provider.getAppToken()
    expect(token1).toEqual(token2)
    expect(fetch).toHaveBeenCalledTimes(1)
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
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-token',
          token_type: 'Bearer',
          expires_in: 7200,
        }),
    } as Response)
    const provider = new EbayProvider(mockConfig)
    ;(provider as any).tokenCache = {
      accessToken: 'old',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }
    const token = await provider.getAppToken()
    expect(token?.accessToken).toBe('new-token')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
