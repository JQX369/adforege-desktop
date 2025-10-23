import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IngestionEngine } from '@/src/lib/clients/ingestion-engine'
import { BaseProduct } from '@/src/lib/clients/types'

// Mock Prisma
const mockPrisma = {
  product: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  merchant: { findFirst: vi.fn(), create: vi.fn() },
  $disconnect: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const makeOpenAIStub = () => ({ embeddings: { create: vi.fn() } }) as any

describe('IngestionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should ingest products with merchant relation connect', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
    const mockProducts: BaseProduct[] = [
      {
        title: 'Test Product',
        description: 'Test Description',
        price: 29.99,
        currency: 'USD',
        url: 'https://example.com/product',
        imageUrl: 'https://example.com/image.jpg',
        brand: 'Test Brand',
        asin: 'B123456789',
        sourceItemId: 'item-123',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 10,
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
    ]
    const mockMerchant = {
      id: 'merchant-123',
      name: 'Test Merchant',
      url: 'https://merchant.com',
    }
    const mockEmbedding = [0.1, 0.2, 0.3]
    mockPrisma.merchant.findFirst.mockResolvedValue(mockMerchant)
    mockPrisma.product.findFirst.mockResolvedValue(null)
    mockPrisma.product.create.mockResolvedValue({ id: 'product-123' })
    ;(engine as any).openai.embeddings.create.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })
    const result = await engine.ingestProducts(mockProducts)
    expect(result.created + result.updated).toBe(1)
    expect(result.success).toBe(true)
  })

  it('should handle missing merchant gracefully', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
    const mockProducts: BaseProduct[] = [
      {
        title: 'Test Product',
        description: 'Test Description',
        price: 29.99,
        currency: 'USD',
        url: 'https://example.com/product',
        imageUrl: 'https://example.com/image.jpg',
        brand: 'Test Brand',
        asin: 'B123456789',
        sourceItemId: 'item-123',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 10,
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
    ]
    const mockEmbedding = [0.1, 0.2, 0.3]
    mockPrisma.merchant.findFirst.mockResolvedValue(null)
    mockPrisma.product.findFirst.mockResolvedValue(null)
    mockPrisma.product.create.mockResolvedValue({ id: 'product-123' })
    ;(engine as any).openai.embeddings.create.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })
    const result = await engine.ingestProducts(mockProducts)
    expect(result.created + result.updated).toBe(1)
    expect(result.success).toBe(true)
  })

  it('should continue on embedding failure', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
    const mockProducts: BaseProduct[] = [
      {
        title: 'Test Product',
        description: 'Test Description',
        price: 29.99,
        currency: 'USD',
        url: 'https://example.com/product',
        imageUrl: 'https://example.com/image.jpg',
        brand: 'Test Brand',
        asin: 'B123456789',
        sourceItemId: 'item-123',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 10,
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
    ]
    mockPrisma.merchant.findFirst.mockResolvedValue(null)
    mockPrisma.product.findFirst.mockResolvedValue(null)
    mockPrisma.product.create.mockResolvedValue({ id: 'product-123' })
    ;(engine as any).openai.embeddings.create.mockRejectedValue(
      new Error('OpenAI API error')
    )
    const result = await engine.ingestProducts(mockProducts)
    expect(result.created + result.updated).toBe(1)
    expect(result.success).toBe(true)
  })

  it('should update existing product correctly', async () => {
    const engine = new IngestionEngine({
      prisma: mockPrisma as any,
      openai: makeOpenAIStub(),
    })
    const mockProducts: BaseProduct[] = [
      {
        title: 'Updated Product',
        description: 'Updated Description',
        price: 39.99,
        currency: 'USD',
        url: 'https://example.com/product',
        imageUrl: 'https://example.com/image.jpg',
        brand: 'Test Brand',
        asin: 'B123456789',
        sourceItemId: 'item-123',
        condition: 'NEW',
        availability: 'IN_STOCK',
        primeEligible: true,
        inStock: true,
        stockQuantity: 5,
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      } as any,
    ]
    const mockMerchant = {
      id: 'merchant-123',
      name: 'Test Merchant',
      url: 'https://merchant.com',
    }
    const mockEmbedding = [0.4, 0.5, 0.6]
    const existingProduct = {
      id: 'product-123',
      title: 'Old Product',
      price: 29.99,
    }
    mockPrisma.merchant.findFirst.mockResolvedValue(mockMerchant)
    mockPrisma.product.findFirst.mockResolvedValue(existingProduct)
    mockPrisma.product.update.mockResolvedValue({ id: 'product-123' })
    ;(engine as any).openai.embeddings.create.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })
    const result = await engine.ingestProducts(mockProducts)
    expect(result.created + result.updated).toBe(1)
    expect(result.success).toBe(true)
  })
})
