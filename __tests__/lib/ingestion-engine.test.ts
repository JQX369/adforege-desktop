import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IngestionEngine } from '@/lib/providers/ingestion-engine'
import { BaseProduct, ProductTagInput, ProductRegionLinkInput } from '@/lib/providers/types'

// Mock Prisma
const mockPrisma = {
  product: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}))

describe('IngestionEngine', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should ingest products with merchant relation connect', async () => {
    const engine = new IngestionEngine()
    
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
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
    ]

    const mockMerchant = {
      id: 'merchant-123',
      name: 'Test Merchant',
      url: 'https://merchant.com',
    }

    const mockEmbedding = [0.1, 0.2, 0.3]

    mockPrisma.merchant.findFirst.mockResolvedValue(mockMerchant)
    mockPrisma.product.findFirst.mockResolvedValue(null) // No existing product
    mockPrisma.product.create.mockResolvedValue({
      id: 'product-123',
      ...mockProducts[0],
      merchant: mockMerchant,
    })
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })

    const result = await engine.ingestProducts(mockProducts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchant: { connect: { id: 'merchant-123' } },
          embedding: mockEmbedding,
        }),
      })
    )
  })

  it('should handle missing merchant gracefully', async () => {
    const engine = new IngestionEngine()
    
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
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
    ]

    const mockEmbedding = [0.1, 0.2, 0.3]

    mockPrisma.merchant.findFirst.mockResolvedValue(null)
    mockPrisma.product.findFirst.mockResolvedValue(null)
    mockPrisma.product.create.mockResolvedValue({
      id: 'product-123',
      ...mockProducts[0],
    })
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })

    const result = await engine.ingestProducts(mockProducts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          merchant: expect.anything(),
        }),
      })
    )
  })

  it('should continue on embedding failure', async () => {
    const engine = new IngestionEngine()
    
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
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
    ]

    mockPrisma.merchant.findFirst.mockResolvedValue(null)
    mockPrisma.product.findFirst.mockResolvedValue(null)
    mockPrisma.product.create.mockResolvedValue({
      id: 'product-123',
      ...mockProducts[0],
    })
    
    // Mock embedding failure
    mockOpenAI.embeddings.create.mockRejectedValue(new Error('OpenAI API error'))

    const result = await engine.ingestProducts(mockProducts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          embedding: [], // Should use empty array on failure
        }),
      })
    )
  })

  it('should update existing product correctly', async () => {
    const engine = new IngestionEngine()
    
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
        listingType: 'FIXED_PRICE',
        country: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
      },
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
    mockPrisma.product.update.mockResolvedValue({
      id: 'product-123',
      ...mockProducts[0],
      merchant: mockMerchant,
    })
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })

    const result = await engine.ingestProducts(mockProducts)

    expect(result.success).toBe(true)
    expect(result.updated).toBe(1)
    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-123' },
        data: expect.objectContaining({
          merchant: { connect: { id: 'merchant-123' } },
          embedding: mockEmbedding,
        }),
      })
    )
  })
})
