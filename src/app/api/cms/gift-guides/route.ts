import { NextRequest, NextResponse } from 'next/server'
import { GiftGuideManager } from '@/src/features/cms/gift-guide-manager'
import { withErrorHandling } from '@/lib/api-error-handler'
import { rateLimiters } from '@/lib/rate-limit'
import { validateInput, schemas } from '@/lib/validation'
import { z } from 'zod'

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const filters = {
    category: searchParams.get('category') || undefined,
    occasion: searchParams.get('occasion') || undefined,
    seasonal: searchParams.get('seasonal') === 'true',
    budget: searchParams.get('budget') || undefined,
    tags: searchParams.get('tags')?.split(',').filter(Boolean),
    published: searchParams.get('published') === 'true',
    search: searchParams.get('search') || undefined,
    limit,
    offset,
  }

  const giftGuideManager = new GiftGuideManager()
  const guides = await giftGuideManager.listGiftGuides(filters)

  return NextResponse.json({
    guides,
    pagination: {
      page,
      limit,
      total: guides.length,
      hasMore: guides.length === limit,
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
      title: z.string().min(1).max(200),
      slug: z.string().min(1).max(200).optional(),
      description: z.string().min(10).max(500),
      category: z.string().min(1),
      occasion: z.string().optional(),
      targetAudience: z.string().optional(),
      products: z.array(z.string()).optional(),
      featuredProducts: z.array(z.string()).optional(),
      seasonal: z.boolean().optional(),
      budget: z.string().optional(),
      tags: z.array(z.string()).optional(),
      seoTitle: z.string().max(60).optional(),
      seoDescription: z.string().max(160).optional(),
      publishedAt: z.string().datetime().optional(),
    }),
    body
  )

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validationResult.errors },
      { status: 400 }
    )
  }

  const giftGuideManager = new GiftGuideManager()
  
  // Ensure slug is provided - generate from title if not provided
  const slug = validationResult.data.slug || 
    validationResult.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  
  const guide = await giftGuideManager.createGiftGuide({
    ...validationResult.data,
    slug,
    publishedAt: validationResult.data.publishedAt
      ? new Date(validationResult.data.publishedAt)
      : undefined,
  })

  return NextResponse.json(guide, { status: 201 })
})
