export const BASIC_PRICE_USD = Number(process.env.NEXT_PUBLIC_BASIC_PRICE_USD ?? '9')
export const FEATURED_PRICE_USD = Number(process.env.NEXT_PUBLIC_FEATURED_PRICE_USD ?? '39')
export const PREMIUM_PRICE_USD = Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_USD ?? '99')

export const ENABLE_SPONSORED_SLOTS = (process.env.NEXT_PUBLIC_ENABLE_SPONSORED_SLOTS ?? 'true') === 'true'
export const SPONSORED_DENSITY_CAP = Number(process.env.NEXT_PUBLIC_SPONSORED_DENSITY_CAP ?? '0.3') // up to 30% of visible list
export const MIN_SPONSORED_RELEVANCE = Number(process.env.NEXT_PUBLIC_MIN_SPONSORED_RELEVANCE ?? '0.6')
export const SPONSORED_SLOT_INDICES: number[] = [0, 3, 6] // 1,4,7 in 1-based indexing

export const AFFILIATE_DISCLOSURE_TEXT =
  process.env.NEXT_PUBLIC_AFFILIATE_DISCLOSURE_TEXT ??
  'As an Amazon Associate, we earn from qualifying purchases.'

export const AFFILIATE_ALLOWED_DOMAINS: string[] = (process.env.AFFILIATE_ALLOWED_DOMAINS ?? 'amazon.com,amazon.co.uk,amazon.ca,amazon.de,amazon.fr,amazon.it,amazon.es,amazon.com.au,amazon.co.jp,amzn.to')
  .split(',')
  .map(d => d.trim())
  .filter(Boolean)

export const AFFILIATE_REQUIRE_ALLOWED = (process.env.AFFILIATE_REQUIRE_ALLOWED ?? 'true') === 'true'

