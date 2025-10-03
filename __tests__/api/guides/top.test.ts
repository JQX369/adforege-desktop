import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Prisma
const mockPrisma = {
  swipe: {
    groupBy: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

import { GET } from '@/app/api/guides/top/route'

describe('GET /api/guides/top', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return top saved products with default parameters', async () => {
    const mockProducts = [
      {
        id: '1',
        title: 'Test Product 1',
        description: 'Description 1',
        price: 29.99,
        images: ['image1.jpg'],
        categories: ['gifts-for-her'],
        affiliateUrl: 'https://example.com/1',
        brand: 'Brand 1',
        rating: 4.5,
        numReviews: 100,
        currency: 'USD',
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        title: 'Test Product 2',
        description: 'Description 2',
        price: 39.99,
        images: ['image2.jpg'],
        categories: ['gifts-for-him'],
        affiliateUrl: 'https://example.com/2',
        brand: 'Brand 2',
        rating: 4.0,
        numReviews: 50,
        currency: 'USD',
        updatedAt: new Date('2024-01-02'),
      },
    ]

    mockPrisma.swipe.groupBy.mockResolvedValue([
      { productId: '1', _count: { productId: 10 } },
      { productId: '2', _count: { productId: 8 } },
    ])

    mockPrisma.product.findMany.mockResolvedValue(mockProducts)

    const request = new NextRequest('http://localhost:3000/api/guides/top')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.products).toHaveLength(2)
    expect(data.products[0].id).toBe('1')
    expect(data.products[0].saveCount).toBe(10)
    expect(data.count).toBe(2)
    expect(data.lastUpdated).toBeDefined()
    expect(data.window).toBe(90)
  })

  it('should filter by category', async () => {
    mockPrisma.swipe.groupBy.mockResolvedValue([
      { productId: '1', _count: { productId: 5 } },
    ])

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: '1',
        title: 'Category Product',
        description: 'Description',
        price: 19.99,
        images: ['image.jpg'],
        categories: ['gifts-for-her'],
        affiliateUrl: 'https://example.com/1',
        brand: 'Brand',
        rating: 4.5,
        numReviews: 25,
        currency: 'USD',
        updatedAt: new Date(),
      },
    ])

    const request = new NextRequest('http://localhost:3000/api/guides/top?category=gifts-for-her')
    const response = await GET(request)
    const data = await response.json()

    expect(mockPrisma.swipe.groupBy).toHaveBeenCalledWith({
      by: ['productId'],
      where: expect.objectContaining({
        product: {
          categories: {
            has: 'gifts-for-her'
          }
        }
      }),
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: expect.any(Number),
    })

    expect(data.filters.category).toBe('gifts-for-her')
  })

  it('should limit results to maximum of 50', async () => {
    const request = new NextRequest('http://localhost:3000/api/guides/top?limit=100')
    const response = await GET(request)
    const data = await response.json()

    expect(data.products.length).toBeLessThanOrEqual(50)
  })

  it('should handle empty results', async () => {
    mockPrisma.swipe.groupBy.mockResolvedValue([])
    mockPrisma.product.findMany.mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/guides/top')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.products).toEqual([])
    expect(data.count).toBe(0)
  })

  it('should handle database errors', async () => {
    mockPrisma.swipe.groupBy.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/guides/top')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch top products')
  })

  it('should apply time decay scoring', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 60) // 60 days ago

    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 1) // 1 day ago

    mockPrisma.swipe.groupBy.mockResolvedValue([
      { productId: '1', _count: { productId: 10 } },
      { productId: '2', _count: { productId: 10 } },
    ])

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: '1',
        title: 'Old Product',
        description: 'Old',
        price: 29.99,
        images: ['image1.jpg'],
        categories: ['gifts'],
        affiliateUrl: 'https://example.com/1',
        brand: 'Brand',
        rating: 4.5,
        numReviews: 10,
        currency: 'USD',
        updatedAt: oldDate,
      },
      {
        id: '2',
        title: 'Recent Product',
        description: 'Recent',
        price: 29.99,
        images: ['image2.jpg'],
        categories: ['gifts'],
        affiliateUrl: 'https://example.com/2',
        brand: 'Brand',
        rating: 4.5,
        numReviews: 10,
        currency: 'USD',
        updatedAt: recentDate,
      },
    ])

    const request = new NextRequest('http://localhost:3000/api/guides/top')
    const response = await GET(request)
    const data = await response.json()

    // Recent product should be first due to time decay
    expect(data.products[0].id).toBe('2')
    expect(data.products[1].id).toBe('1')
  })
})
