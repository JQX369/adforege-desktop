'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import { BASIC_PRICE_USD, FEATURED_PRICE_USD, PREMIUM_PRICE_USD } from '@/lib/config'
import { detectGeoFromBrowser, getCurrencySymbol } from '@/lib/geo'
import { getCurrencyFromCountry, type SupportedCurrency } from '@/lib/prices'

export default function VendorPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<'BASIC' | 'FEATURED' | 'PREMIUM'>('BASIC')
  const [quantity, setQuantity] = useState<number>(1)
  const [submitted, setSubmitted] = useState(false)
  const [currency, setCurrency] = useState<SupportedCurrency>('USD')
  const [currencySymbol, setCurrencySymbol] = useState('$')

  // Detect user's currency on mount
  useEffect(() => {
    const geo = detectGeoFromBrowser()
    const detectedCurrency = getCurrencyFromCountry(geo.country)
    setCurrency(detectedCurrency)
    setCurrencySymbol(getCurrencySymbol(geo.currency))
  }, [])

  // Get pricing in local currency
  const getLocalPrice = (tier: 'BASIC' | 'FEATURED' | 'PREMIUM'): number => {
    const priceMap = {
      'BASIC': { USD: 9.99, GBP: 8.99, EUR: 9.49 },
      'FEATURED': { USD: 19.99, GBP: 17.99, EUR: 18.99 },
      'PREMIUM': { USD: 29.99, GBP: 27.99, EUR: 28.99 }
    }
    return priceMap[tier][currency]
  }

  const startCheckout = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/vendor/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selected, quantity }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      if (data?.url) {
        window.location.href = data.url
      } else {
        setSubmitted(true)
      }
    } catch (e: any) {
      alert(e.message || 'Unable to start checkout')
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-accent/20">
        <div className="container mx-auto px-4 py-16">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="pt-12 pb-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Check your email</h2>
              <p className="text-muted-foreground">If you completed checkout, you will be redirected back shortly.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      
      <div className="container mx-auto px-4 py-12 relative z-10">
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/20">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-white/80 text-sm">Live Demo Mode</span>
          </div>
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Grow Sales with The Gift Aunty
          </h1>
          <p className="text-2xl text-purple-100 mb-4">Get discovered by gift-seekers. Pay monthly. Cancel anytime.</p>
          <div className="max-w-3xl mx-auto bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <p className="text-purple-200 text-lg leading-relaxed">
              📊 See views, swipes, and favorites on your products<br/>
              🧪 Use The Gift Aunty as a product test bed to validate what resonates before scaling<br/>
              🎯 Reach thousands of active gift-seekers powered by AI
            </p>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-8 max-w-[1100px] mx-auto mb-16">
          <PricingCard
            name="Basic"
            price={getLocalPrice('BASIC')}
            currencySymbol={currencySymbol}
            description="Starter visibility for small shops"
            features={["Appear in AI recommendations", "Basic analytics", "Email support"]}
            selected={selected === 'BASIC'}
            onSelect={() => setSelected('BASIC')}
          />
          <PricingCard
            name="Featured"
            price={getLocalPrice('FEATURED')}
            currencySymbol={currencySymbol}
            description="Boosted exposure and better placement"
            features={["Priority placement", "Feature badge", "Advanced analytics", "Priority support"]}
            selected={selected === 'FEATURED'}
            onSelect={() => setSelected('FEATURED')}
            popular={true}
          />
          <PricingCard
            name="Premium"
            price={getLocalPrice('PREMIUM')}
            currencySymbol={currencySymbol}
            description="Maximum reach for growing brands"
            features={["Top placement", "Premium badge", "Full analytics suite", "Dedicated support"]}
            selected={selected === 'PREMIUM'}
            onSelect={() => setSelected('PREMIUM')}
          />
        </div>

        <div className="text-center">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10 max-w-md mx-auto">
            <h3 className="text-white text-lg font-semibold mb-4">Customize Your Plan</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-purple-100">Selected Plan:</span>
                <span className="text-white font-medium">{selected}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-purple-100">Product Listings:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || isLoading}
                    className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-white font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(100, quantity + 1))}
                    disabled={quantity >= 100 || isLoading}
                    className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
              
              <div className="border-t border-white/20 pt-4">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-purple-100">Total per month:</span>
                  <span className="text-white font-bold">
                    {currencySymbol}{(getLocalPrice(selected) * quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            size="lg" 
            onClick={startCheckout} 
            disabled={isLoading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-4 text-xl rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 border-0"
          >
            {isLoading ? 'Starting…' : '🚀 Start Growing Sales'}
          </Button>
          
          <div className="mt-6 space-y-2">
            <p className="text-purple-200 text-sm">Each unit = 1 product listing. Add more anytime.</p>
            <p className="text-purple-200 text-sm">Billed monthly • Cancel anytime • No trial</p>
          </div>
          
          <div className="mt-6">
            <a className="text-purple-300 hover:text-white underline transition-colors text-sm" href="/auth/sign-in">
              Already have an account? Sign in →
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}

function PricingCard({ name, price, currencySymbol, description, features, selected, onSelect, popular }: {
  name: string
  price: number
  currencySymbol: string
  description: string
  features: string[]
  selected: boolean
  onSelect: () => void
  popular?: boolean
}) {
  return (
    <div className={`relative ${popular ? 'z-10' : ''}`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
          <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-medium">
            Most Popular
          </span>
        </div>
      )}
      <div className={`${popular ? 'p-[2px] rounded-2xl bg-[linear-gradient(90deg,rgba(236,72,153,0.9),rgba(168,85,247,0.9))]' : ''}`}>
        <Card 
          className={`cursor-pointer glass-panel hover-float transition-all duration-300 ${selected ? 'ring-2 ring-purple-400' : ''} ${popular ? 'scale-105' : ''}`}
          onClick={onSelect}
        >
        <CardHeader className="text-center">
          <CardTitle className="text-white text-2xl">{name}</CardTitle>
          <CardDescription className="text-purple-100">{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-5xl font-bold mb-6 text-white">
            <span className="text-2xl">{currencySymbol}</span>{price}
            <span className="text-lg text-purple-100">/mo</span>
          </div>
          <ul className="space-y-3 mb-6">
            {features.map((f) => (
              <li key={f} className="text-purple-50 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                {f}
              </li>
            ))}
          </ul>
          {selected && (
            <div className="text-purple-300 text-sm font-medium">
              ✓ Selected
            </div>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  )
}