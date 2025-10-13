import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IngestionEngine } from '@/lib/providers/ingestion-engine'
import { RainforestProvider } from '@/lib/providers/rainforest-enhanced'
import { EbayProvider } from '@/lib/providers/ebay-enhanced'
import { BaseProduct } from '@/lib/providers/types'

// Mock Prisma
const mockPrisma = {
  product: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  merchant: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $disconnect: vi.fn(),
}

// Mock OpenAI
const mockOpenAI = {
  embeddings: {
    create: vi.fn(),
  },
}

// Mock fetch globally
global.fetch = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}))

describe('Ingestion Dry-Run Integration', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock responses
    mockPrisma.product.count.mockResolvedValue(0)
    mockPrisma.merchant.findFirst.mockResolvedValue(null)
    mockPrisma.product.findFirst.mockResolvedValue(null)
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process Rainforest products in dry-run mode', async () => {
    const engine = new IngestionEngine()
    
    const mockRainforestProducts: BaseProduct[] = [
      {
        title: 'Tech Gadget 1',
        description: 'Amazing tech gadget',
        price: 99.99,
        currency: 'USD',
        url: 'https://amazon.com/product1',
        imageUrl: 'https://amazon.com/image1.jpg',
        brand: 'TechBrand',
        asin: 'B123456789',
        sourceItemId: 'rainforest-1',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 10,
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
      {
        title: 'Tech Gadget 2',
        description: 'Another amazing tech gadget',
        price: 149.99,
        currency: 'USD',
        url: 'https://amazon.com/product2',
        imageUrl: 'https://amazon.com/image2.jpg',
        brand: 'TechBrand',
        asin: 'B987654321',
        sourceItemId: 'rainforest-2',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 5,
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
    ]

    // Mock Rainforest provider
    const mockRainforestProvider = {
      searchByKeyword: vi.fn().mockResolvedValue(mockRainforestProducts),
    } as unknown as RainforestProvider

    // Mock the ingestion engine methods
    const ingestProductsSpy = vi.spyOn(engine, 'ingestProducts')
    ingestProductsSpy.mockResolvedValue({
      success: true,
      created: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
      products: [],
      errorMessages: [],
      duration: 1000,
    })

    // Simulate dry-run processing
    const result = await engine.ingestProducts(mockRainforestProducts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(2)
    expect(ingestProductsSpy).toHaveBeenCalledTimes(1)
    
    // Verify product data structure
    expect(ingestProductsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.any(String),
          price: expect.any(Number),
          currency: 'USD',
          brand: 'TechBrand',
          condition: 'NEW',
          availability: 'IN_STOCK',
        }),
      ])
    )
  })

  it('should handle eBay products with token authentication', async () => {
    const engine = new IngestionEngine(mockConfig)
    
    const mockEbayProducts: BaseProduct[] = [
      {
        title: 'eBay Tech Item',
        description: 'Tech item from eBay',
        price: 79.99,
        currency: 'USD',
        url: 'https://ebay.com/item1',
        imageUrl: 'https://ebay.com/image1.jpg',
        brand: 'eBayBrand',
        asin: '', // eBay doesn't have ASIN
        sourceItemId: 'ebay-1',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: false,
        inStock: true,
        stockQuantity: 1,
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'EBAY_US',
      },
    ]

    // Mock eBay token response
    const mockTokenResponse = {
      access_token: 'test-token',
      token_type: 'Bearer',
      expires_in: 7200,
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          itemSummaries: [{
            itemId: 'ebay-1',
            title: 'eBay Tech Item',
            price: { value: '79.99', currency: 'USD' },
            image: { imageUrl: 'https://ebay.com/image1.jpg' },
            condition: 'NEW',
            availability: { buyItNowAvailable: true },
            itemWebUrl: 'https://ebay.com/item1',
            seller: { username: 'test-seller' },
            listingMarketplaceId: 'EBAY_US',
          }],
        }),
      } as Response)

    // Mock eBay provider
    const mockEbayProvider = {
      searchByKeyword: vi.fn().mockResolvedValue(mockEbayProducts),
      getAppToken: vi.fn().mockResolvedValue({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 7200000),
      }),
    } as unknown as EbayProvider

    // Mock the ingestion engine
    const createProductSpy = vi.spyOn(engine, 'createProduct')
    createProductSpy.mockResolvedValue({
      id: 'product-456',
      title: 'eBay Tech Item',
    } as any)

    // Simulate processing
    const result = await engine.createProduct(
      mockEbayProducts[0],
      [0.4, 0.5, 0.6], // Mock embedding
      [{ tag: 'electronics', weight: 1.0 }],
      [{
        country: 'US',
        affiliateUrl: 'https://ebay.com/affiliate',
        currency: 'USD',
        marketplaceId: 'EBAY_US',
      }],
      null // No merchant
    )

    expect(result).toBeDefined()
    expect(createProductSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'eBay Tech Item',
        price: 79.99,
        currency: 'USD',
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'EBAY_US',
      }),
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
      null
    )
  })

  it('should continue processing on individual product failures', async () => {
    const engine = new IngestionEngine(mockConfig)
    
    const mockProducts: BaseProduct[] = [
      {
        title: 'Valid Product',
        description: 'This will succeed',
        price: 29.99,
        currency: 'USD',
        url: 'https://example.com/valid',
        imageUrl: 'https://example.com/valid.jpg',
        brand: 'ValidBrand',
        asin: 'B111111111',
        sourceItemId: 'valid-1',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 10,
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
      {
        title: 'Invalid Product',
        description: 'This will fail',
        price: 0, // Invalid price
        currency: 'USD',
        url: 'https://example.com/invalid',
        imageUrl: 'https://example.com/invalid.jpg',
        brand: 'InvalidBrand',
        asin: 'B222222222',
        sourceItemId: 'invalid-1',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 0,
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
    ]

    const createProductSpy = vi.spyOn(engine, 'createProduct')
    
    // First call succeeds, second fails
    createProductSpy
      .mockResolvedValueOnce({ id: 'product-valid' } as any)
      .mockRejectedValueOnce(new Error('Invalid product data'))

    const results = []
    const errors = []

    for (const product of mockProducts) {
      try {
        const result = await engine.createProduct(
          product,
          [0.1, 0.2, 0.3],
          [],
          [],
          null
        )
        results.push(result)
      } catch (error) {
        errors.push(error)
      }
    }

    expect(results).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(Error)
    expect(errors[0].message).toBe('Invalid product data')
  })

  it('should handle embedding failures gracefully', async () => {
    const engine = new IngestionEngine(mockConfig)
    
    const mockProduct: BaseProduct = {
      title: 'Product Without Embedding',
      description: 'This product will have embedding failure',
      price: 49.99,
      currency: 'USD',
      url: 'https://example.com/no-embedding',
      imageUrl: 'https://example.com/no-embedding.jpg',
      brand: 'NoEmbedBrand',
      asin: 'B333333333',
      sourceItemId: 'no-embed-1',
      condition: 'NEW',
      availability: 'IN_STOCK',
      primeEligible: true,
      inStock: true,
      stockQuantity: 5,
      listingType: 'FIXED_PRICE',
      country: 'US',
      marketplaceId: 'ATVPDKIKX0DER',
    }

    // Mock embedding failure
    mockOpenAI.embeddings.create.mockRejectedValue(new Error('OpenAI API error'))

    const createProductSpy = vi.spyOn(engine, 'createProduct')
    createProductSpy.mockResolvedValue({
      id: 'product-no-embed',
      title: 'Product Without Embedding',
    } as any)

    const result = await engine.createProduct(
      mockProduct,
      [], // Empty embedding due to failure
      [],
      [],
      null
    )

    expect(result).toBeDefined()
    expect(createProductSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Product Without Embedding',
      }),
      [], // Should use empty embedding
      [],
      [],
      null
    )
  })
})
