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
Object.defineProperty(navigator, 'language', {
  value: 'en-US',
  writable: true,
})

// Also mock navigator.languages for completeness
Object.defineProperty(navigator, 'languages', {
  value: ['en-US', 'en'],
  writable: true,
})

// Test component that uses the currency context
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
    document.cookie = ''
    // Reset navigator.language to default for each test
    Object.defineProperty(navigator, 'language', {
      value: 'en',
      writable: true,
    })
  })

  it('should provide default USD currency', async () => {
    // Mock navigator.language for this specific test
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
    })

    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('USD')
    })
  })

  it('should detect currency from browser locale', async () => {
    navigator.language = 'en-GB'

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
      expect(screen.getByTestId('currency')).toHaveTextContent('USD')
    })

    fireEvent.click(screen.getByTestId('set-gbp'))

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('GBP')
    })

    fireEvent.click(screen.getByTestId('set-eur'))

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('EUR')
    })
  })

  it('should set cookie when currency changes', async () => {
    // Mock navigator.language for this specific test
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
    })

    const mockSetCookie = vi.fn()
    Object.defineProperty(document, 'cookie', {
      set: mockSetCookie,
      configurable: true
    })

    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('USD')
    })

    fireEvent.click(screen.getByTestId('set-gbp'))

    expect(mockSetCookie).toHaveBeenCalledWith(
      expect.stringContaining('preferred-currency=GBP')
    )
  })

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestComponent />)).toThrow(
      'useCurrency must be used within a CurrencyProvider'
    )

    consoleSpy.mockRestore()
  })
})
