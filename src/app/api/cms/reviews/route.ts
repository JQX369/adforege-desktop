import { NextRequest, NextResponse } from 'next/server'
import { ReviewManager } from '@/src/features/cms/review-manager'
import { withErrorHandling } from '@/lib/api-error-handler'
import { rateLimiters } from '@/lib/rate-limit'
import { validateInput, schemas } from '@/lib/validation'
import { z } from 'zod'

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const filters = {
    productId: searchParams.get('productId') || undefined,
    userId: searchParams.get('userId') || undefined,
    contentId: searchParams.get('contentId') || undefined,
    rating: searchParams.get('rating')
      ? parseInt(searchParams.get('rating')!)
      : undefined,
    status: searchParams.get('status') as any,
    verified: searchParams.get('verified') === 'true',
    limit,
    offset,
  }

  const reviewManager = new ReviewManager()
  const reviews = await reviewManager.listReviews(filters)

  return NextResponse.json({
    reviews,
    pagination: {
      page,
      limit,
      total: reviews.length,
      hasMore: reviews.length === limit,
    },
  })
})

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
      userId: z.string().optional(),
      contentId: z.string().optional(),
      rating: z.number().min(1).max(5),
      title: z.string().max(200).optional(),
      reviewText: z.string().min(10).max(1000),
      pros: z.array(z.string()).optional(),
      cons: z.array(z.string()).optional(),
      verified: z.boolean().optional(),
    }),
    body
  )

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validationResult.errors },
      { status: 400 }
    )
  }

  const reviewManager = new ReviewManager()

  // Validate review
  const validation = await reviewManager.validateReview(validationResult.data)
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Invalid review', details: validation.errors },
      { status: 400 }
    )
  }

  const review = await reviewManager.createReview(validationResult.data)

  return NextResponse.json(review, { status: 201 })
})
