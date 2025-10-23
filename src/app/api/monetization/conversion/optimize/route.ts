import { NextRequest, NextResponse } from 'next/server'
import { conversionOptimization } from '@/src/features/monetization/conversion-optimization'
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
      type: z.enum(['checkout', 'pricing', 'recommendations', 'ab_test']),
      vendorId: z.string().optional(),
      userId: z.string().optional(),
      experimentName: z.string().optional(),
      variant: z.string().optional(),
    }),
    body
  )

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validationResult.errors },
      { status: 400 }
    )
  }

  const { type, vendorId, userId, experimentName, variant } =
    validationResult.data

  try {
    let result

    switch (type) {
      case 'checkout':
        if (!vendorId) {
          return NextResponse.json(
            { error: 'Vendor ID is required for checkout optimization' },
            { status: 400 }
          )
        }
        result = await conversionOptimization.optimizeCheckoutFlow(vendorId)
        break

      case 'pricing':
        result = await conversionOptimization.optimizePricingStrategy()
        break

      case 'recommendations':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required for recommendation optimization' },
            { status: 400 }
          )
        }
        result = await conversionOptimization.optimizeRecommendations(userId)
        break

      case 'ab_test':
        if (!experimentName || !userId) {
          return NextResponse.json(
            {
              error: 'Experiment name and user ID are required for A/B testing',
            },
            { status: 400 }
          )
        }
        const assignedVariant = await conversionOptimization.runABTest(
          experimentName as any,
          userId,
          variant
        )
        result = { success: true, variant: assignedVariant }
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
    console.error('Error optimizing conversion:', error)
    return NextResponse.json(
      { error: 'Failed to optimize conversion' },
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
    const analytics = await conversionOptimization.getConversionAnalytics(
      startDate,
      endDate
    )

    return NextResponse.json({
      success: true,
      analytics,
    })
  } catch (error) {
    console.error('Error fetching conversion analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversion analytics' },
      { status: 500 }
    )
  }
})
