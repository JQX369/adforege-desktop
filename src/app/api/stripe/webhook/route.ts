import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { logError, logInfo } from '@/lib/log'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(req: NextRequest) {
  try {
    if (!webhookSecret) {
      logError('STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    if (!sig) {
      logError('Missing stripe-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err: any) {
      logError('Webhook signature verification failed', {
        message: err.message,
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Optional: persist webhook event for idempotency if a table exists in your DB.
    // Skipping persistence to avoid type errors when Prisma model is not defined.

    logInfo('Processing Stripe webhook', { type: event.type })

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (
          session.mode === 'subscription' &&
          session.customer &&
          session.subscription
        ) {
          const customerId = session.customer as string
          const subscriptionId = session.subscription as string

          // Find vendor by Stripe customer ID
          const vendor = await prisma.vendor.findUnique({
            where: { stripeCustomerId: customerId },
          })

          if (vendor) {
            // Get subscription details
            const subscription =
              await stripe.subscriptions.retrieve(subscriptionId)
            const lineItem = subscription.items.data[0]
            const quantity = lineItem?.quantity || 1

            // Determine plan from price lookup key or product metadata
            let plan = 'BASIC'
            if (lineItem?.price.lookup_key?.includes('featured'))
              plan = 'FEATURED'
            else if (lineItem?.price.lookup_key?.includes('premium'))
              plan = 'PREMIUM'

            await prisma.vendor.update({
              where: { id: vendor.id },
              data: {
                stripeSubscriptionId: subscriptionId,
                plan: plan as any,
                subscriptionStatus: 'ACTIVE',
                currentPeriodEnd: new Date(
                  subscription.current_period_end * 1000
                ),
              },
            })

            logInfo('Updated vendor subscription', {
              vendorId: vendor.id,
              plan,
              quantity,
            })
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const vendor = await prisma.vendor.findUnique({
          where: { stripeCustomerId: customerId },
        })

        if (vendor) {
          const lineItem = subscription.items.data[0]
          let plan = 'BASIC'
          if (lineItem?.price.lookup_key?.includes('featured'))
            plan = 'FEATURED'
          else if (lineItem?.price.lookup_key?.includes('premium'))
            plan = 'PREMIUM'

          await prisma.vendor.update({
            where: { id: vendor.id },
            data: {
              plan: plan as any,
              subscriptionStatus:
                subscription.status === 'active'
                  ? 'ACTIVE'
                  : subscription.status === 'past_due'
                    ? 'PAST_DUE'
                    : subscription.status === 'canceled'
                      ? 'CANCELED'
                      : 'INACTIVE',
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const vendor = await prisma.vendor.findUnique({
          where: { stripeCustomerId: customerId },
        })

        if (vendor) {
          await prisma.vendor.update({
            where: { id: vendor.id },
            data: {
              subscriptionStatus: 'CANCELED',
              currentPeriodEnd: null,
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const vendor = await prisma.vendor.findUnique({
          where: { stripeCustomerId: customerId },
        })

        if (vendor) {
          await prisma.vendor.update({
            where: { id: vendor.id },
            data: {
              subscriptionStatus: 'PAST_DUE',
            },
          })
        }
        break
      }

      default:
        logInfo('Unhandled Stripe event type', { type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    logError('Webhook error', { error: err })
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
