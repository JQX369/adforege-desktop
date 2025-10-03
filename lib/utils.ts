import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Very simple in-memory rate limiter for server runtime
const rlBuckets: Record<string, { tokens: number; ts: number }> = {}
export function rateLimit(key: string, maxPerMin: number): boolean {
  const now = Date.now()
  const windowMs = 60_000
  const b = rlBuckets[key] || { tokens: maxPerMin, ts: now }
  const elapsed = now - b.ts
  const refill = Math.floor(elapsed / windowMs) * maxPerMin
  b.tokens = Math.min(maxPerMin, b.tokens + (refill > 0 ? refill : 0))
  b.ts = refill > 0 ? now : b.ts
  if (b.tokens <= 0) {
    rlBuckets[key] = b
    return false
  }
  b.tokens -= 1
  rlBuckets[key] = b
  return true
}