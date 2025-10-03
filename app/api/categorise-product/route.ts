import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import { buildCategorizerPrompt, extractEmbeddingText, ProductData } from '@/prompts/CategoriserPrompt'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isActiveSubscriptionStatus } from '@/lib/vendor-access'
import { cleanProductUrl } from '@/lib/affiliates'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Require authenticated vendor with ACTIVE subscription
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const productData = body as Partial<ProductData>
    const requiredFields: Array<keyof ProductData> = ['title', 'description', 'price', 'images', 'originalUrl']
    const missing = requiredFields.filter(field => {
      const value = productData[field as keyof ProductData]
      if (field === 'images') return !Array.isArray(value)
      return value === undefined || value === null || value === ''
    })
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const payload: ProductData = {
      title: String(productData.title),
      description: String(productData.description),
      price: Number(productData.price),
      images: Array.isArray(productData.images) ? productData.images.map(String) : [],
      originalUrl: String(productData.originalUrl),
      vendorEmail: productData.vendorEmail ? String(productData.vendorEmail) : (user.email || ''),
    }

    const openAiKey = process.env.OPENAI_API_KEY
    if (!openAiKey) {
      console.error('categorise-product: OPENAI_API_KEY missing')
      return NextResponse.json({ error: 'Server misconfigured: OpenAI unavailable' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: openAiKey })

    // Clean the URL
    const cleanedUrl = cleanProductUrl(payload.originalUrl)

    // Generate categorization using OpenAI
    const prompt = buildCategorizerPrompt(payload)

    const completion = await openai.responses.create({
      model: process.env.OPENAI_GIFT_MODEL || 'gpt-5.0-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: 'You are a product categorization expert. Always respond with valid JSON.' }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      temperature: 0.7,
    })

    const responseText = completion.output_text
      ? completion.output_text
      : completion.output
          ?.flatMap((segment: any) => segment.content || [])
          .filter((segment: any) => segment.type === 'output_text')
          .map((segment: any) => segment.text)
          .join('') ||
        '{}'

    const analysis = JSON.parse(responseText)

    // Generate embedding for the product
    const embeddingText = extractEmbeddingText(payload, analysis)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText,
    })
    const embedding = embeddingResponse.data[0].embedding

    // Verify vendor has active subscription
    const vendor = await prisma.vendor.findUnique({ where: { userId: user.id } })
    if (!vendor || !isActiveSubscriptionStatus(vendor.subscriptionStatus)) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 402 })
    }

    // Find existing product or create new one
    const existing = await prisma.product.findFirst({
      where: { affiliateUrl: cleanedUrl }
    })

    const productData = {
      title: payload.title,
      description: payload.description,
      price: payload.price,
      images: payload.images,
      categories: analysis.categories || [],
      vendorEmail: payload.vendorEmail || vendor.email,
      vendorId: vendor.id,
      status: 'PENDING' as const,
    }

    const savedProduct = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...productData,
            embeddings: embedding?.length
              ? {
                  upsert: {
                    update: { embedding, updatedAt: new Date() },
                    create: { embedding },
                  },
                }
              : undefined,
          },
        })
      : await prisma.product.create({
          data: {
            ...productData,
            affiliateUrl: cleanedUrl,
            embeddings: embedding?.length
              ? {
                  create: { embedding },
                }
              : undefined,
          },
        })

    return NextResponse.json({
      success: true,
      productId: savedProduct.id,
      categories: savedProduct.categories,
      status: savedProduct.status,
      message: 'Product submitted successfully. It will be reviewed before appearing in recommendations.',
    })
  } catch (error) {
    console.error('Error in categorise-product API:', error)
    return NextResponse.json(
      { error: 'Failed to categorize product' },
      { status: 500 }
    )
  }
} 