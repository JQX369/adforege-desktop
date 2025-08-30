// IP-based geolocation and currency detection
export interface GeoInfo {
  country: string
  currency: string
  amazonDomain: string
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  'US': 'USD',
  'GB': 'GBP', 
  'CA': 'CAD',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'AU': 'AUD',
  'JP': 'JPY',
  'IN': 'INR',
  'BR': 'BRL',
  'MX': 'MXN',
}

const COUNTRY_TO_AMAZON: Record<string, string> = {
  'US': 'amazon.com',
  'GB': 'amazon.co.uk',
  'CA': 'amazon.ca', 
  'DE': 'amazon.de',
  'FR': 'amazon.fr',
  'IT': 'amazon.it',
  'ES': 'amazon.es',
  'AU': 'amazon.com.au',
  'JP': 'amazon.co.jp',
  'IN': 'amazon.in',
  'BR': 'amazon.com.br',
  'MX': 'amazon.com.mx',
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'GBP': '£',
  'EUR': '€',
  'CAD': 'C$',
  'AUD': 'A$',
  'JPY': '¥',
  'INR': '₹',
  'BRL': 'R$',
  'MXN': 'MX$',
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || '$'
}

export async function detectGeoFromIP(): Promise<GeoInfo> {
  try {
    // Use a free IP geolocation service
    const response = await fetch('https://ipapi.co/json/', {
      headers: { 'User-Agent': 'My Favorite Aunty/1.0' }
    })
    
    if (!response.ok) throw new Error('Geo API failed')
    
    const data = await response.json()
    const country = data.country_code || 'US'
    
    return {
      country,
      currency: COUNTRY_TO_CURRENCY[country] || 'USD',
      amazonDomain: COUNTRY_TO_AMAZON[country] || 'amazon.com'
    }
  } catch (error) {
    console.warn('IP geolocation failed, defaulting to US:', error)
    return {
      country: 'US',
      currency: 'USD', 
      amazonDomain: 'amazon.com'
    }
  }
}

export function detectGeoFromBrowser(): GeoInfo {
  try {
    if (typeof navigator === 'undefined') {
      return { country: 'US', currency: 'USD', amazonDomain: 'amazon.com' }
    }

    // Try to get country from browser locale
    const locale = navigator.language || 'en-US'
    const country = locale.split('-')[1] || 'US'
    
    return {
      country,
      currency: COUNTRY_TO_CURRENCY[country] || 'USD',
      amazonDomain: COUNTRY_TO_AMAZON[country] || 'amazon.com'
    }
  } catch (error) {
    return { country: 'US', currency: 'USD', amazonDomain: 'amazon.com' }
  }
}
