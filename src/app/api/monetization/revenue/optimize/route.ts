import { NextRequest, NextResponse } from 'next/server'
import { revenueOptimization } from '@/src/features/monetization/revenue-optimization'
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
      type: z.enum([
        'overall',
        'affiliate',
        'subscriptions',
        'dynamic_pricing',
      ]),
      parameters: z.record(z.any()).optional(),
    }),
    body
  )

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validationResult.errors },
      { status: 400 }
    )
  }

  const { type, parameters } = validationResult.data

  try {
    let result

    switch (type) {
      case 'overall':
        result = await revenueOptimization.optimizeRevenue()
        break

      case 'affiliate':
        result = await revenueOptimization.optimizeAffiliateRevenue()
        break

      case 'subscriptions':
        result = await revenueOptimization.optimizeVendorSubscriptions()
        break

      case 'dynamic_pricing':
        result = await revenueOptimization.implementDynamicPricing()
        break

      default:
        return NextResponse.json(
          { error: 'Invalid optimization type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      type,
      result,
    })
  } catch (error) {
    console.error('Error optimizing revenue:', error)
    return NextResponse.json(
      { error: 'Failed to optimize revenue' },
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
    const analytics = await revenueOptimization.getRevenueAnalytics(
      startDate,
      endDate
    )

    return NextResponse.json({
      success: true,
      analytics,
    })
  } catch (error) {
    console.error('Error fetching revenue analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revenue analytics' },
      { status: 500 }
    )
  }
})
