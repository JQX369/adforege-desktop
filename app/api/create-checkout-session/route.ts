import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || ''
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { vendorEmail, productData } = body || {}

    const origin = new URL(request.url).origin

    // Minimal validation
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    // Stripe metadata has limits; trim values
    const md = {
      vendorEmail: String(vendorEmail || productData?.vendorEmail || '').slice(0, 200),
      title: String(productData?.title || '').slice(0, 200),
      description: String(productData?.description || '').slice(0, 500),
      price: String(productData?.price || ''),
      originalUrl: String(productData?.originalUrl || '').slice(0, 500),
      image0: Array.isArray(productData?.images) && productData.images[0] ? String(productData.images[0]).slice(0, 500) : '',
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'hosted',
      success_url: `${origin}/vendor?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vendor?canceled=1`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'My Favorite Aunty Vendor Listing',
              description: '30-day listing to appear in AI recommendations',
            },
            unit_amount: Math.round(Number(process.env.NEXT_PUBLIC_BASIC_PRICE_USD || '9') * 100),
          },
          quantity: 1,
        },
      ],
      metadata: md,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    const message = (error as any)?.message || 'Unknown error'
    console.error('Error in create-checkout-session:', message)
    return NextResponse.json({ error: `Failed to create checkout session: ${message}` }, { status: 500 })
  }
}

