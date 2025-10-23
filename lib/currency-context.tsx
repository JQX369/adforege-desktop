'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { SupportedCurrency } from './prices'

interface CurrencyContextType {
  currency: SupportedCurrency
  setCurrency: (currency: SupportedCurrency) => void
  isLoading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
)

interface CurrencyProviderProps {
  children: ReactNode
  initialCurrency?: SupportedCurrency
}

export function CurrencyProvider({
  children,
  initialCurrency = 'GBP',
}: CurrencyProviderProps) {
  const [currency, setCurrencyState] =
    useState<SupportedCurrency>(initialCurrency)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get currency from cookie or middleware header
    const getInitialCurrency = async () => {
      try {
        // First try to get from cookie
        const cookieCurrency = document.cookie
          .split('; ')
          .find((row) => row.startsWith('preferred-currency='))
          ?.split('=')[1] as SupportedCurrency

        if (cookieCurrency && ['USD', 'GBP', 'EUR'].includes(cookieCurrency)) {
          setCurrencyState(cookieCurrency)
          setIsLoading(false)
          return
        }

        // Fallback to detecting from browser locale
        const locale = navigator.language
        const countryCode = locale.split('-')[1]?.toUpperCase()

        if (countryCode) {
          // Simple mapping - in production, you'd use a more comprehensive mapping
          if (countryCode === 'GB' || countryCode === 'UK') {
            setCurrencyState('GBP')
          } else if (
            [
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
            ].includes(countryCode)
          ) {
            setCurrencyState('EUR')
          }
        }
      } catch (error) {
        console.warn('Currency detection failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getInitialCurrency()
  }, [])

  const setCurrency = (newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency)
    // Update cookie
    document.cookie = `preferred-currency=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}

// Currency display utilities
export function formatPrice(
  amount: number,
  currency: SupportedCurrency
): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  return formatter.format(amount)
}

export function getCurrencySymbol(currency: SupportedCurrency): string {
  switch (currency) {
    case 'GBP':
      return '£'
    case 'EUR':
      return '€'
    case 'USD':
      return '$'
    default:
      return '$'
  }
}
