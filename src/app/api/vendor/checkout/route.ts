import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  getPriceIdForTier,
  getCurrencyFromCountry,
  type SubscriptionTier,
  type SupportedCurrency,
} from '@/src/shared/constants/prices'
import { detectGeoFromIP } from '@/src/shared/constants/geo'

export const runtime = 'nodejs'

export type { SubscriptionTier }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tier?: SubscriptionTier
      quantity?: number
    }
    const tier = body?.tier
    const quantity = Math.max(
      1,
      Math.min(100, Math.floor((body?.quantity as number) || 1))
    )
    if (!tier || !['BASIC', 'FEATURED', 'PREMIUM'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid or missing tier' },
        { status: 400 }
      )
    }

    // Determine currency from visitor IP -> country, default USD
    const geo = await detectGeoFromIP()
    const currency = getCurrencyFromCountry(geo?.country)
    const priceId = getPriceIdForTier(tier, currency)

    console.log(
      `Checkout: tier=${tier}, currency=${currency}, quantity=${quantity}, priceId=${priceId}`
    )
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured' },
        { status: 500 }
      )
    }

    // Auth: require logged-in vendor
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in first' },
        { status: 401 }
      )
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || ''
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
    const prisma = new PrismaClient()

    // Find or create Vendor row
    const email = user.email || ''
    let vendor = await prisma.vendor.findUnique({ where: { userId: user.id } })
    if (!vendor) {
      vendor = await prisma.vendor.upsert({
        where: { email },
        update: { userId: user.id },
        create: { userId: user.id, email },
      })
    }

    // Ensure Stripe customer
    let customerId = vendor.stripeCustomerId || undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { vendorId: vendor.id, userId: user.id },
      })
      customerId = customer.id
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create checkout session
    const origin = new URL(req.url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity }],
      success_url: `${origin}/vendor/dashboard?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vendor?canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
