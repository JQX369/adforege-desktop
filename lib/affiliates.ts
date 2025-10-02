function isAmazonHost(hostname: string): boolean {
  return (
    hostname === 'amazon.com' ||
    hostname.endsWith('.amazon.com') ||
    hostname.includes('amazon.') ||
    hostname.startsWith('smile.amazon.')
  )
}

export function isAmazonUrl(urlString: string): boolean {
  try {
    const h = new URL(urlString).hostname.toLowerCase()
    return isAmazonHost(h) || h === 'amzn.to'
  } catch {
    return false
  }
}

export function isAllowedAffiliate(urlString: string, allowedDomains: string[], requireAllowed: boolean): boolean {
  try {
    const hostname = new URL(urlString).hostname.toLowerCase()
    if (!requireAllowed) return true
    return allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

const COUNTRY_TO_AMAZON_DOMAIN: Record<string, string> = {
  US: 'amazon.com',
  GB: 'amazon.co.uk',
  UK: 'amazon.co.uk',
  CA: 'amazon.ca',
  AU: 'amazon.com.au',
  DE: 'amazon.de',
  FR: 'amazon.fr',
  ES: 'amazon.es',
  IT: 'amazon.it',
  IN: 'amazon.in',
  JP: 'amazon.co.jp',
}

export function localizeAmazonUrl(rawUrl: string, countryCode?: string): string {
  try {
    const url = new URL(rawUrl)
    const hostname = url.hostname.toLowerCase()
    if (!isAmazonHost(hostname)) return rawUrl
    const cc = (countryCode || 'US').toUpperCase()
    const domain = COUNTRY_TO_AMAZON_DOMAIN[cc]
    if (!domain) return rawUrl
    url.hostname = domain
    return url.toString()
  } catch {
    return rawUrl
  }
}

export function buildAffiliateUrlWithLocale(rawUrl: string, countryCode?: string): string {
  const localized = localizeAmazonUrl(rawUrl, countryCode)
  return buildAffiliateUrl(localized, countryCode)
}

export function buildAffiliateUrl(rawUrl: string, countryCode?: string): string {
  // Get environment variables
  const amazonTag = process.env.NEXT_PUBLIC_AMZ_TAG
  const etsyRef = process.env.NEXT_PUBLIC_ETSY_ID
  const ebayCampaignId = process.env.EBAY_CAMPAIGN_ID
  const ebayCustomPrefix = process.env.EBAY_CUSTOM_ID_PREFIX || 'giftaunty'

  try {
    const url = new URL(rawUrl)
    const hostname = url.hostname.toLowerCase()

    // Amazon affiliate link (all TLDs) and amzn.to short links
    if (isAmazonHost(hostname) || hostname === 'amzn.to') {
      if (amazonTag) {
        // Check if tag already exists
        const existingTag = url.searchParams.get('tag')
        if (!existingTag) {
          url.searchParams.set('tag', amazonTag)
        }
      }
      return url.toString()
    }

    // Etsy affiliate link
    if (hostname.includes('etsy.com')) {
      if (etsyRef) {
        // Check if ref already exists
        const existingRef = url.searchParams.get('ref')
        if (!existingRef) {
          url.searchParams.set('ref', etsyRef)
        }
      }
      return url.toString()
    }

    // eBay affiliate link (EPN) - minimal parameterization
    if (hostname.includes('ebay.')) {
      if (ebayCampaignId) {
        if (!url.searchParams.get('campid')) {
          url.searchParams.set('campid', ebayCampaignId)
        }
        if (!url.searchParams.get('customid')) {
          const custom = `${ebayCustomPrefix}-${Date.now().toString(36)}`
          url.searchParams.set('customid', custom)
        }
        if (countryCode) {
          url.searchParams.set('geo', countryCode.toLowerCase())
        }
      }
      return url.toString()
    }

    // Return original URL for non-affiliate sites
    return rawUrl
  } catch (error) {
    // If URL parsing fails, return original
    console.error('Failed to parse URL for affiliate link:', error)
    return rawUrl
  }
}

// Helper to check if URL is from a supported affiliate program
export function isSupportedAffiliate(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return (
      isAmazonHost(hostname) ||
      hostname === 'amzn.to' ||
      hostname.includes('etsy.com')
    )
  } catch {
    return false
  }
}

// Extract clean product URL (remove tracking params except affiliate ones)
export function cleanProductUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Keep only essential params for different platforms
    const essentialParams: Record<string, string[]> = {
      // For any amazon.* domain, keep only tag
      'amazon': ['tag'],
      'amzn.to': ['tag'],
      'etsy.com': ['ref', 'listing_id', 'pro'],
    }
    
    // Find matching domain
    const domain = Object.keys(essentialParams).find(d => d === 'amazon' ? hostname.includes('amazon.') : hostname.includes(d))
    
    if (domain) {
      const paramsToKeep = essentialParams[domain]
      const searchParams = new URLSearchParams()
      
      // Keep only essential params
      paramsToKeep.forEach(param => {
        const value = urlObj.searchParams.get(param)
        if (value) {
          searchParams.set(param, value)
        }
      })
      
      urlObj.search = searchParams.toString()
    }
    
    return urlObj.toString()
  } catch (error) {
    console.error('Failed to clean URL:', error)
    return url
  }
} 