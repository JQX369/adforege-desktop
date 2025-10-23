import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IngestionEngine } from '@/src/lib/clients/ingestion-engine'
import { RainforestProvider } from '@/src/lib/clients/rainforest-enhanced'
import { EbayProvider } from '@/src/lib/clients/ebay-enhanced'
import { BaseProduct } from '@/src/lib/clients/types'

// Mock Prisma
const mockPrisma = {
  product: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  merchant: { findFirst: vi.fn(), create: vi.fn() },
  $disconnect: vi.fn(),
}

// Mock fetch globally
global.fetch = vi.fn()

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('openai', () => ({
  default: class {
    embeddings = { create: vi.fn() }
    constructor(..._args: any[]) {}
  },
}))

const makeOpenAIStub = () =>
  ({
    embeddings: {
      create: vi
        .fn()
        .mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    },
  }) as any

describe('Ingestion Dry-Run Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.product.count.mockResolvedValue(0)
    mockPrisma.merchant.findFirst.mockResolvedValue(null)
    mockPrisma.product.findFirst.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process Rainforest products in dry-run mode', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
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
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
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
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
    ]
    mockPrisma.product.create.mockResolvedValue({ id: 'p1' })
    const result = await engine.ingestProducts(mockRainforestProducts)
    expect(result.created + result.updated).toBeGreaterThanOrEqual(1)
    expect(result.success).toBe(true)
  })

  it('should handle eBay products with token authentication', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
    const mockEbayProducts: BaseProduct[] = [
      {
        title: 'eBay Tech Item',
        description: 'Tech item from eBay',
        price: 79.99,
        currency: 'USD',
        url: 'https://ebay.com/item1',
        imageUrl: 'https://ebay.com/image1.jpg',
        brand: 'eBayBrand',
        asin: '',
        sourceItemId: 'ebay-1',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: false,
        inStock: true,
        stockQuantity: 1,
        country: 'US',
        marketplaceId: 'EBAY_US',
      } as any,
    ]
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 7200,
        }),
    } as Response)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ itemSummaries: [] }),
    } as Response)
    mockPrisma.product.create.mockResolvedValue({ id: 'product-456' })
    const result = await engine.ingestProducts(mockEbayProducts)
    expect(result.created + result.updated).toBeGreaterThanOrEqual(1)
    expect(result.success).toBe(true)
  })

  it('should continue processing on individual product failures', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
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
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
      {
        title: 'Invalid Product',
        description: 'This will fail',
        price: 0,
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
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
    ]
    mockPrisma.product.create
      .mockResolvedValueOnce({ id: 'product-valid' })
      .mockRejectedValueOnce(new Error('Invalid product data'))
    const result = await engine.ingestProducts(mockProducts)
    expect(result.errors).toBeGreaterThanOrEqual(1)
    expect(result.created + result.updated).toBeGreaterThanOrEqual(1)
  })

  it('should handle embedding failures gracefully', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
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
      country: 'US',
      marketplaceId: 'ATVPDKIKX0DER',
    } as any
    ;(engine as any).openai.embeddings.create.mockRejectedValue(
      new Error('OpenAI API error')
    )
    mockPrisma.product.create.mockResolvedValue({ id: 'product-no-embed' })
    const result = await engine.ingestProducts([mockProduct])
    expect(result.created + result.updated).toBeGreaterThanOrEqual(1)
    expect(result.success).toBe(true)
  })
})
