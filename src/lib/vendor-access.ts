export type SubscriptionStatus =
  | 'INACTIVE'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'PAUSED'

export function isActiveSubscriptionStatus(
  status: SubscriptionStatus | string | null | undefined
): boolean {
  return status === 'ACTIVE'
}
