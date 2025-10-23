'use client'

import { useState } from 'react'
import { Button } from '@/src/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/ui/dropdown-menu'
import { useCurrency, getCurrencySymbol } from '@/lib/currency-context'
import { SupportedCurrency } from '@/src/shared/constants/prices'

const currencies: { code: SupportedCurrency; name: string; symbol: string }[] =
  [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ]

export function CurrencySelector() {
  const { currency, setCurrency, isLoading } = useCurrency()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return <div className="w-16 h-8 bg-muted animate-pulse rounded" />
  }

  const currentCurrency = currencies.find((c) => c.code === currency)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 min-w-[60px]"
          aria-label={`Current currency: ${currentCurrency?.name || 'USD'}`}
        >
          <span className="font-mono font-medium">
            {currentCurrency?.symbol || '$'}
          </span>
          <span className="text-xs opacity-75">{currency}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {currencies.map((curr) => (
          <DropdownMenuItem
            key={curr.code}
            onClick={() => {
              setCurrency(curr.code)
              setIsOpen(false)
            }}
            className={`flex items-center gap-3 ${
              currency === curr.code ? 'bg-accent' : ''
            }`}
          >
            <span className="font-mono font-medium text-lg">{curr.symbol}</span>
            <div className="flex flex-col">
              <span className="font-medium">{curr.name}</span>
              <span className="text-xs text-muted-foreground">{curr.code}</span>
            </div>
            {currency === curr.code && (
              <span className="ml-auto text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Compact version for header
export function CompactCurrencySelector() {
  const { currency, setCurrency, isLoading } = useCurrency()

  if (isLoading) {
    return <div className="w-8 h-6 bg-muted animate-pulse rounded" />
  }

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
      className="bg-transparent border-none text-sm font-mono font-medium cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5"
      aria-label="Select currency"
    >
      {currencies.map((curr) => (
        <option key={curr.code} value={curr.code}>
          {curr.symbol} {curr.code}
        </option>
      ))}
    </select>
  )
}
