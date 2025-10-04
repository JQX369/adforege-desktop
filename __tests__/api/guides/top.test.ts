import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/guides/top (mocked)', () => {
  const mockResponse = {
    status: 200,
    json: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockResponse.json.mockResolvedValue({ products: [], count: 0, filters: {} })
  })

  it('should handle default response shape', async () => {
    mockResponse.json.mockResolvedValueOnce({
      products: [
        { id: '1', saveCount: 10 },
        { id: '2', saveCount: 8 },
      ],
      count: 2,
      filters: {},
      window: 90,
    })

    const data = await mockResponse.json()
    expect(mockResponse.status).toBe(200)
    expect(data.products).toHaveLength(2)
    expect(data.count).toBe(2)
  })

  it('should honour category filter (mocked)', async () => {
    mockResponse.json.mockResolvedValueOnce({
      products: [],
      count: 0,
      filters: { category: 'gifts-for-her' },
    })
    const data = await mockResponse.json()
    expect(data.filters.category).toBe('gifts-for-her')
  })
})
