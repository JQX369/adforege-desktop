'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/ui/card'
import { Button } from '@/src/ui/button'
import { CheckCircle } from 'lucide-react'
import {
  BASIC_PRICE_USD,
  FEATURED_PRICE_USD,
  PREMIUM_PRICE_USD,
} from '@/lib/config'
import {
  detectGeoFromBrowser,
  getCurrencySymbol,
} from '@/src/shared/constants/geo'
import {
  getCurrencyFromCountry,
  type SupportedCurrency,
} from '@/src/shared/constants/prices'

export default function VendorPageClient() {
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<'BASIC' | 'FEATURED' | 'PREMIUM'>(
    'BASIC'
  )
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
      BASIC: { USD: 9.99, GBP: 8.99, EUR: 9.49 },
      FEATURED: { USD: 29.99, GBP: 26.99, EUR: 28.49 },
      PREMIUM: { USD: 99.99, GBP: 89.99, EUR: 94.99 },
    }
    return priceMap[tier][currency]
  }

  const handleProceedToPayment = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/vendor/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selected, quantity }),
      })

      if (!res.ok) {
        throw new Error('Checkout failed')
      }

      const data = await res.json()

      if (data.sessionId) {
        // Redirect to Stripe Checkout
        window.location.href = data.url
      } else {
        // Demo mode - show success
        setSubmitted(true)
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment processing failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const tiers = [
    {
      id: 'BASIC' as const,
      name: 'Basic Listing',
      price: getLocalPrice('BASIC'),
      description: 'Perfect for individual sellers and small businesses',
      features: [
        'List up to 5 products',
        'Basic demographic matching',
        'Standard placement in search results',
        'Email support',
        '6-month listing duration',
      ],
      popular: false,
    },
    {
      id: 'FEATURED' as const,
      name: 'Featured Listing',
      price: getLocalPrice('FEATURED'),
      description: 'Enhanced visibility for growing businesses',
      features: [
        'List up to 20 products',
        'Priority placement when demographics match',
        'Enhanced visibility (2x more likely to appear)',
        'Detailed analytics dashboard',
        'Priority support',
        '12-month listing duration',
      ],
      popular: true,
    },
    {
      id: 'PREMIUM' as const,
      name: 'Premium Listing',
      price: getLocalPrice('PREMIUM'),
      description: 'Maximum exposure for established brands',
      features: [
        'Unlimited product listings',
        'Top priority placement across all searches',
        'Brand spotlight on homepage',
        'Dedicated vendor profile page',
        'Custom brand storytelling section',
        'Direct customer messaging',
        'API access for inventory updates',
        'Dedicated account manager',
      ],
      popular: false,
    },
  ]

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-accent/10 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-4">
                Demo Mode - Payment Successful!
              </h1>
              <p className="text-muted-foreground mb-8">
                In a real implementation, you would be redirected to Stripe
                Checkout to complete your payment. Your vendor account would be
                activated upon successful payment.
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Selected Plan</h2>
              <div className="text-left">
                <p>
                  <strong>Tier:</strong>{' '}
                  {tiers.find((t) => t.id === selected)?.name}
                </p>
                <p>
                  <strong>Quantity:</strong> {quantity} product
                  {quantity > 1 ? 's' : ''}
                </p>
                <p>
                  <strong>Total:</strong> {currencySymbol}
                  {getLocalPrice(selected) * quantity}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => setSubmitted(false)}
                variant="outline"
                className="w-full"
              >
                ← Back to Plans
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
                className="w-full"
              >
                Continue to FairyWize
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Join Our Vendor Marketplace
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Reach thousands of gift-seekers and grow your business with
            FairyWize's AI-powered recommendation platform. Choose the plan that
            fits your needs and start selling today.
          </p>

          {/* Demo Mode Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium mb-8">
            🚧 Demo Mode - No real payments processed
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              className={`relative ${tier.popular ? 'ring-2 ring-primary shadow-lg' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {currencySymbol}
                    {tier.price}
                  </span>
                  <span className="text-muted-foreground">/product</span>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${tier.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                  variant={tier.popular ? 'default' : 'outline'}
                  onClick={() => setSelected(tier.id)}
                >
                  {selected === tier.id ? 'Selected' : 'Select Plan'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quantity Selector */}
        <div className="max-w-md mx-auto mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Quantity</CardTitle>
              <CardDescription className="text-center">
                How many products do you want to list?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="text-2xl font-bold min-w-[3rem] text-center">
                  {quantity}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Total and Proceed */}
        <div className="text-center">
          <div className="mb-6">
            <p className="text-2xl font-bold">
              Total: {currencySymbol}
              {getLocalPrice(selected) * quantity}
            </p>
            <p className="text-muted-foreground">
              {quantity} × {tiers.find((t) => t.id === selected)?.name}
            </p>
          </div>

          <Button
            onClick={handleProceedToPayment}
            disabled={isLoading}
            size="lg"
            className="px-8 py-3"
          >
            {isLoading ? 'Processing...' : 'Proceed to Payment'}
          </Button>

          <p className="text-sm text-muted-foreground mt-4">
            Secure payment processing by Stripe. Cancel anytime.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  How does the AI matching work?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes user responses to understand gift preferences,
                  relationships, and occasions. Products are then ranked based
                  on relevance, quality scores, and demographic matching.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  What payment methods do you accept?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We accept all major credit cards, PayPal, and bank transfers
                  through our secure Stripe integration.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Can I upgrade or downgrade my plan?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Yes, you can change your plan at any time. Upgrades take
                  effect immediately, while downgrades take effect at your next
                  billing cycle.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We offer a 30-day money-back guarantee for all new vendors.
                  Contact support if you're not satisfied with our service.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
