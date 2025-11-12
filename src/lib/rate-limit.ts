import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (req: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

// In-memory store for rate limiting (in production, use Redis)
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()

  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key)
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key)
      return undefined
    }
    return entry
  }

  set(key: string, count: number, resetTime: number): void {
    this.store.set(key, { count, resetTime })
  }

  increment(key: string, windowMs: number): number {
    const now = Date.now()
    const entry = this.get(key)

    if (!entry) {
      this.set(key, 1, now + windowMs)
      return 1
    }

    const newCount = entry.count + 1
    this.set(key, newCount, entry.resetTime)
    return newCount
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.store.entries())
    for (const [key, entry] of entries) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }
}

const store = new RateLimitStore()

// Clean up expired entries every 5 minutes
setInterval(() => store.cleanup(), 5 * 60 * 1000)

export function createRateLimit(config: RateLimitConfig) {
  return (req: NextRequest): RateLimitResult => {
    const key = config.keyGenerator
      ? config.keyGenerator(req)
      : getDefaultKey(req)
    const now = Date.now()
    const windowMs = config.windowMs
    const maxRequests = config.maxRequests

    const count = store.increment(key, windowMs)
    const remaining = Math.max(0, maxRequests - count)
    const resetTime = now + windowMs

    if (count > maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      }
    }

    return {
      success: true,
      limit: maxRequests,
      remaining,
      resetTime,
    }
  }
}

function getDefaultKey(req: NextRequest): string {
  // Use IP address as default key
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  return `rate_limit:${ip}`
}

// Predefined rate limiters
export const rateLimiters = {
  // General API rate limiting
  api: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
      return `api:${ip}`
    },
  }),

  // Recommendation API (more restrictive)
  recommendations: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
      return `rec:${ip}`
    },
  }),

  // Authentication endpoints
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
      return `auth:${ip}`
    },
  }),

  // Vendor operations
  vendor: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
      return `vendor:${ip}`
    },
  }),

  // Admin operations (very restrictive)
  admin: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
      return `admin:${ip}`
    },
  }),
}

// Utility function to check rate limit and return appropriate response
export function checkRateLimit(
  req: NextRequest,
  limiter: (req: NextRequest) => RateLimitResult
): RateLimitResult | null {
  const result = limiter(req)

  if (!result.success) {
    return result
  }

  return null
}

// Middleware helper for API routes
export function withRateLimit(
  limiter: (req: NextRequest) => RateLimitResult,
  handler: (req: NextRequest) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    const rateLimitResult = checkRateLimit(req, limiter)

    if (rateLimitResult) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      )
    }

    return handler(req)
  }
}
