import { NextRequest, NextResponse } from 'next/server'
import { ContentManager } from '@/src/features/cms/content-manager'
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
    type: searchParams.get('type') as any,
    status: searchParams.get('status') as any,
    authorId: searchParams.get('authorId') || undefined,
    tags: searchParams.get('tags')?.split(',').filter(Boolean),
    categories: searchParams.get('categories')?.split(',').filter(Boolean),
    published: searchParams.get('published') === 'true',
    search: searchParams.get('search') || undefined,
    limit,
    offset,
  }

  const contentManager = new ContentManager()
  const content = await contentManager.listContent(filters)

  return NextResponse.json({
    content,
    pagination: {
      page,
      limit,
      total: content.length,
      hasMore: content.length === limit,
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
      description: z.string().max(500).optional(),
      content: z.string().min(10),
      excerpt: z.string().max(300).optional(),
      type: z.enum(['BLOG_POST', 'GIFT_GUIDE', 'REVIEW', 'FAQ', 'TUTORIAL']),
      status: z
        .enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED'])
        .optional(),
      authorId: z.string().optional(),
      featuredImage: z.string().url().optional(),
      tags: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      seoTitle: z.string().max(60).optional(),
      seoDescription: z.string().max(160).optional(),
      metaKeywords: z.array(z.string()).optional(),
      publishedAt: z.string().datetime().optional(),
      scheduledAt: z.string().datetime().optional(),
    }),
    body
  )

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validationResult.errors },
      { status: 400 }
    )
  }

  const contentManager = new ContentManager()
  const content = await contentManager.createContent({
    ...validationResult.data,
    publishedAt: validationResult.data.publishedAt
      ? new Date(validationResult.data.publishedAt)
      : undefined,
    scheduledAt: validationResult.data.scheduledAt
      ? new Date(validationResult.data.scheduledAt)
      : undefined,
  })

  return NextResponse.json(content, { status: 201 })
})
