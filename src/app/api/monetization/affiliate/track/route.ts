import { NextRequest, NextResponse } from 'next/server'
import { affiliateProgram } from '@/src/features/monetization/affiliate-expansion'
import { withErrorHandling } from '@/lib/api-error-handler'
import { rateLimiters } from '@/lib/rate-limit'
import { validateInput, schemas } from '@/lib/validation'
import { z } from 'zod'

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Rate limiting
  const rateLimitResult = rateLimiters.recommendations(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    )
  }

  const body = await request.json()

  // Input validation
  const validationResult = validateInput(
    z.object({
      productId: z.string().min(1),
      program: z.enum([
        'amazon',
        'ebay',
        'etsy',
        'target',
        'walmart',
        'bestbuy',
        'homedepot',
        'lowes',
        'macys',
        'nordstrom',
      ]),
      userId: z.string().optional(),
      action: z.enum(['click', 'conversion']),
      revenue: z.number().min(0).optional(),
      orderId: z.string().optional(),
    }),
    body
  )

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validationResult.errors },
      { status: 400 }
    )
  }

  const { productId, program, userId, action, revenue, orderId } =
    validationResult.data

  try {
    if (action === 'click') {
      // Track affiliate click
      const clickId = `${userId || 'anon'}-${productId}-${Date.now().toString(36)}`
      await affiliateProgram.trackClick(clickId, program, productId, userId)

      return NextResponse.json({
        success: true,
        clickId,
        message: 'Click tracked successfully',
      })
    } else if (action === 'conversion') {
      // Track affiliate conversion
      if (!revenue) {
        return NextResponse.json(
          { error: 'Revenue is required for conversion tracking' },
          { status: 400 }
        )
      }

      const clickId = body.clickId
      if (!clickId) {
        return NextResponse.json(
          { error: 'Click ID is required for conversion tracking' },
          { status: 400 }
        )
      }

      await affiliateProgram.trackConversion(clickId, program, revenue, orderId)

      return NextResponse.json({
        success: true,
        message: 'Conversion tracked successfully',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error tracking affiliate event:', error)
    return NextResponse.json(
      { error: 'Failed to track affiliate event' },
      { status: 500 }
    )
  }
})

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  const startDate = searchParams.get('startDate')
    ? new Date(searchParams.get('startDate')!)
    : undefined
  const endDate = searchParams.get('endDate')
    ? new Date(searchParams.get('endDate')!)
    : undefined

  try {
    const analytics = await affiliateProgram.getAffiliateAnalytics(
      startDate,
      endDate
    )

    return NextResponse.json({
      success: true,
      analytics,
    })
  } catch (error) {
    console.error('Error fetching affiliate analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch affiliate analytics' },
      { status: 500 }
    )
  }
})
