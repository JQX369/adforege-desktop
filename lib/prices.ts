export type SubscriptionTier = 'BASIC' | 'FEATURED' | 'PREMIUM'

export type SupportedCurrency = 'USD' | 'GBP' | 'EUR'

export function getCurrencyFromCountry(countryCode: string | undefined): SupportedCurrency {
	const cc = (countryCode || '').toUpperCase()
	if (cc === 'GB' || cc === 'UK' || cc === 'GG' || cc === 'JE' || cc === 'IM') return 'GBP'
	const eurCountries = new Set(['AT','BE','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES'])
	if (eurCountries.has(cc)) return 'EUR'
	return 'USD'
}

export function getPriceIdForTier(tier: SubscriptionTier, currency: SupportedCurrency = 'USD'): string | null {
	const env = process.env as Record<string, string | undefined>
	const normalizedCurrency = (currency || 'USD').toUpperCase() as SupportedCurrency
	const keyWithCurrency = `STRIPE_PRICE_${tier}_${normalizedCurrency}`
	const legacyKey = `STRIPE_PRICE_${tier}`

	return env[keyWithCurrency] ?? env[legacyKey] ?? null
}