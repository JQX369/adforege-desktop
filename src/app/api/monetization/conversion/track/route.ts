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
      userId: z.string().min(1),
      eventType: z.enum(['signup', 'purchase', 'subscription', 'upgrade']),
      value: z.number().min(0).optional(),
      metadata: z.record(z.any()).optional(),
    }),
    body
  )

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validationResult.errors },
      { status: 400 }
    )
  }

  const { userId, eventType, value, metadata } = validationResult.data

  try {
    await conversionOptimization.trackConversion(
      userId,
      eventType,
      value,
      metadata
    )

    return NextResponse.json({
      success: true,
      message: 'Conversion event tracked successfully',
    })
  } catch (error) {
    console.error('Error tracking conversion event:', error)
    return NextResponse.json(
      { error: 'Failed to track conversion event' },
      { status: 500 }
    )
  }
})
