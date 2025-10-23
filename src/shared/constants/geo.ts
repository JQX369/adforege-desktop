// Geo utility: map IP or locale to marketplace/router information

export interface GeoInfo {
  country: string
  currency: string
  amazonDomain: string
  marketplaceId: string
  currencySymbol: string
}

export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  UK: 'GBP',
  CA: 'CAD',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  AU: 'AUD',
  JP: 'JPY',
  IN: 'INR',
  BR: 'BRL',
  MX: 'MXN',
  IE: 'EUR',
  NL: 'EUR',
}

export const COUNTRY_TO_AMAZON: Record<string, string> = {
  US: 'amazon.com',
  GB: 'amazon.co.uk',
  UK: 'amazon.co.uk',
  CA: 'amazon.ca',
  DE: 'amazon.de',
  FR: 'amazon.fr',
  IT: 'amazon.it',
  ES: 'amazon.es',
  AU: 'amazon.com.au',
  JP: 'amazon.co.jp',
  IN: 'amazon.in',
  BR: 'amazon.com.br',
  MX: 'amazon.com.mx',
}

export const COUNTRY_TO_EBAY_MARKETPLACE: Record<string, string> = {
  US: 'EBAY_US',
  GB: 'EBAY_GB',
  UK: 'EBAY_GB',
  CA: 'EBAY_CA',
  DE: 'EBAY_DE',
  AU: 'EBAY_AU',
  FR: 'EBAY_FR',
  IT: 'EBAY_IT',
  ES: 'EBAY_ES',
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
}

const DEFAULT_GEO: GeoInfo = {
  country: 'GB',
  currency: 'GBP',
  amazonDomain: 'amazon.co.uk',
  marketplaceId: 'EBAY_GB',
  currencySymbol: '£',
}

function normalizeCountry(country: string | undefined): string {
  if (!country) return DEFAULT_GEO.country
  return country.trim().toUpperCase()
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || '$'
}

export function buildGeoInfo(countryCode: string): GeoInfo {
  const country = normalizeCountry(countryCode)
  const currency = COUNTRY_TO_CURRENCY[country] || DEFAULT_GEO.currency
  return {
    country,
    currency,
    amazonDomain: COUNTRY_TO_AMAZON[country] || DEFAULT_GEO.amazonDomain,
    marketplaceId:
      COUNTRY_TO_EBAY_MARKETPLACE[country] || DEFAULT_GEO.marketplaceId,
    currencySymbol: getCurrencySymbol(currency),
  }
}

export async function detectGeoFromIP(): Promise<GeoInfo> {
  try {
    const endpoint = process.env.GEO_LOOKUP_ENDPOINT || 'https://ipapi.co/json/'
    const response = await fetch(endpoint, {
      headers: { 'User-Agent': 'PresentGoGo/1.0' },
      cache: 'no-store',
    })

    if (!response.ok) throw new Error(`Geo API failed: ${response.status}`)

    const data = await response.json()
    const country = data.country_code || data.country || DEFAULT_GEO.country

    return buildGeoInfo(country)
  } catch (error) {
    console.warn('IP geolocation failed, defaulting to US:', error)
    return DEFAULT_GEO
  }
}

export function detectGeoFromBrowser(): GeoInfo {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_GEO
    }

    const stored = window.localStorage.getItem('pg_geo')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.country) {
          return buildGeoInfo(parsed.country)
        }
      } catch {
        // ignore malformed localStorage
      }
    }

    const locale = navigator.language || 'en-US'
    const parts = locale.split('-')
    const country = parts[1] || DEFAULT_GEO.country

    return buildGeoInfo(country)
  } catch (error) {
    console.warn('Browser geo detection failed:', error)
    return DEFAULT_GEO
  }
}

export function cacheGeoInfo(info: GeoInfo) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('pg_geo', JSON.stringify(info))
  } catch {
    // ignore storage errors
  }
}

export async function resolveGeo(headers: Headers): Promise<GeoInfo> {
  const headerCountry =
    headers.get('x-vercel-ip-country') ||
    headers.get('x-country-code') ||
    headers.get('cf-ipcountry') ||
    headers.get('geoip-country') ||
    headers.get('x-geo-country') ||
    undefined

  if (headerCountry) {
    return buildGeoInfo(headerCountry)
  }

  return detectGeoFromIP()
}
