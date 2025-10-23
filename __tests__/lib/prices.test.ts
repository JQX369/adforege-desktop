import { describe, it, expect } from 'vitest'
import {
  getCurrencyFromCountry,
  SupportedCurrency,
} from '@/src/shared/constants/prices'

describe('Currency Detection', () => {
  it('should return GBP for UK countries', () => {
    expect(getCurrencyFromCountry('GB')).toBe('GBP')
    expect(getCurrencyFromCountry('UK')).toBe('GBP')
    expect(getCurrencyFromCountry('GG')).toBe('GBP') // Guernsey
    expect(getCurrencyFromCountry('JE')).toBe('GBP') // Jersey
    expect(getCurrencyFromCountry('IM')).toBe('GBP') // Isle of Man
  })

  it('should return EUR for Euro countries', () => {
    const euroCountries = [
      'AT',
      'BE',
      'CY',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'IE',
      'IT',
      'LV',
      'LT',
      'LU',
      'MT',
      'NL',
      'PT',
      'SK',
      'SI',
      'ES',
    ]
    euroCountries.forEach((country) => {
      expect(getCurrencyFromCountry(country)).toBe('EUR')
    })
  })

  it('should return USD for all other countries', () => {
    expect(getCurrencyFromCountry('US')).toBe('USD')
    expect(getCurrencyFromCountry('CA')).toBe('USD')
    expect(getCurrencyFromCountry('AU')).toBe('USD')
    expect(getCurrencyFromCountry('JP')).toBe('USD')
    expect(getCurrencyFromCountry('')).toBe('USD')
    expect(getCurrencyFromCountry(undefined)).toBe('USD')
  })

  it('should handle case insensitive input', () => {
    expect(getCurrencyFromCountry('gb')).toBe('GBP')
    expect(getCurrencyFromCountry('Us')).toBe('USD')
    expect(getCurrencyFromCountry('fr')).toBe('EUR')
  })
})
