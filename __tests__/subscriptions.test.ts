import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getPlanForPriceId,
  mapStripeStatusToSubscriptionStatus,
} from '@/lib/subscriptions'

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

describe('getPlanForPriceId', () => {
  it('maps price ids to plans', () => {
    expect(getPlanForPriceId('price_basic_123')).toBe('BASIC')
    expect(getPlanForPriceId('price_featured_456')).toBe('FEATURED')
    expect(getPlanForPriceId('price_premium_789')).toBe('PREMIUM')
    expect(getPlanForPriceId('other')).toBeNull()
  })
})

describe('mapStripeStatusToSubscriptionStatus', () => {
  it('maps stripe status', () => {
    expect(mapStripeStatusToSubscriptionStatus('active')).toBe('ACTIVE')
    expect(mapStripeStatusToSubscriptionStatus('trialing')).toBe('ACTIVE')
    expect(mapStripeStatusToSubscriptionStatus('past_due')).toBe('PAST_DUE')
    expect(mapStripeStatusToSubscriptionStatus('canceled')).toBe('CANCELED')
    expect(mapStripeStatusToSubscriptionStatus('unknown')).toBe('INACTIVE')
  })
})
