import { describe, it, expect, beforeEach, afterEach } from 'vitest'

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
	originalEnv = { ...process.env }
	process.env.STRIPE_PRICE_BASIC = 'price_basic_123'
	process.env.STRIPE_PRICE_FEATURED = 'price_featured_456'
	process.env.STRIPE_PRICE_PREMIUM = 'price_premium_789'
})

afterEach(() => {
	process.env = originalEnv
})

describe('getPriceIdForTier', () => {
    it('returns correct price id for each tier', async () => {
        const { getPriceIdForTier } = await import('@/lib/prices')
        expect(getPriceIdForTier('BASIC')).toBe('price_basic_123')
        expect(getPriceIdForTier('FEATURED')).toBe('price_featured_456')
        expect(getPriceIdForTier('PREMIUM')).toBe('price_premium_789')
    })

    it('returns null for invalid tier or missing env', async () => {
        const { getPriceIdForTier } = await import('@/lib/prices')
        expect(getPriceIdForTier('GOLD' as any)).toBeNull()
        delete process.env.STRIPE_PRICE_BASIC
        expect(getPriceIdForTier('BASIC')).toBeNull()
    })
})
