import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CurrencyProvider, useCurrency } from '@/lib/currency-context'

// Mock localStorage and document.cookie
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock navigator.language
type Nav = typeof navigator & { language: string }

Object.defineProperty(navigator, 'language', { value: 'en-GB', writable: true })
Object.defineProperty(navigator, 'languages', {
  value: ['en-GB', 'en'],
  writable: true,
})

function TestComponent() {
  const { currency, setCurrency, isLoading } = useCurrency()
  if (isLoading) return <div>Loading...</div>
  return (
    <div>
      <div data-testid="currency">{currency}</div>
      <button onClick={() => setCurrency('GBP')} data-testid="set-gbp">
        Set GBP
      </button>
      <button onClick={() => setCurrency('EUR')} data-testid="set-eur">
        Set EUR
      </button>
    </div>
  )
}

describe('Currency Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset cookie property
    try {
      delete (document as any).cookie
    } catch {}
    Object.defineProperty(document, 'cookie', {
      value: '',
      writable: true,
      configurable: true,
    })
    ;(navigator as Nav).language = 'en-GB'
  })

  it('should provide default GBP currency', async () => {
    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('GBP')
    })
  })

  it('should detect currency from browser locale', async () => {
    ;(navigator as Nav).language = 'en-GB'
    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('GBP')
    })
  })

  it('should allow currency switching', async () => {
    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('GBP')
    })

    fireEvent.click(screen.getByTestId('set-eur'))
    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('EUR')
    })
  })

  it('should set cookie when currency changes', async () => {
    // Redefine cookie setter
    try {
      delete (document as any).cookie
    } catch {}
    const setCookieSpy = vi.fn()
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: setCookieSpy as any,
    })

    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('GBP')
    })

    fireEvent.click(screen.getByTestId('set-eur'))
    expect(setCookieSpy).toHaveBeenCalled()
  })

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestComponent />)).toThrow(
      'useCurrency must be used within a CurrencyProvider'
    )
    consoleSpy.mockRestore()
  })
})
