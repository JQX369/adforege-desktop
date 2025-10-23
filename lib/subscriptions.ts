export type VendorPlan = 'BASIC' | 'FEATURED' | 'PREMIUM'
export type SubscriptionStatus =
  | 'INACTIVE'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'PAUSED'

export function getPlanForPriceId(
  priceId: string | null | undefined
): VendorPlan | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_BASIC) return 'BASIC'
  if (priceId === process.env.STRIPE_PRICE_FEATURED) return 'FEATURED'
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return 'PREMIUM'
  return null
}

export function mapStripeStatusToSubscriptionStatus(
  status: string | null | undefined
): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'PAST_DUE'
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED'
    default:
      return 'INACTIVE'
  }
}
