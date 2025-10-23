// Simple in-memory cache for API responses
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttl: number = 3600000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Global cache instance
export const cache = new MemoryCache()

// Cache wrapper for async functions
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600000 // 1 hour default
): Promise<T> {
  const cached = cache.get<T>(key)
  if (cached) return cached

  const data = await fetcher()
  cache.set(key, data, ttl)
  return data
}

// Cache keys generator
export const cacheKeys = {
  recommendations: (userId: string, formData: any) =>
    `recs:${userId}:${JSON.stringify(formData)}`,

  product: (productId: string) => `product:${productId}`,

  giftGuides: () => 'gift-guides:all',

  vendorStats: (vendorId: string) => `vendor:stats:${vendorId}`,

  healthCheck: () => 'health:check',
}

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const
