import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import { buildCategorizerPrompt, extractEmbeddingText, ProductData } from '@/prompts/CategoriserPrompt'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isActiveSubscriptionStatus } from '@/lib/vendor-access'
import { cleanProductUrl } from '@/lib/affiliates'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const prisma = new PrismaClient()

// Remove edge runtime - Prisma doesn't support it
// export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    // Require authenticated vendor with ACTIVE subscription
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const productData = body as ProductData

    // Clean the URL
    const cleanedUrl = cleanProductUrl(productData.originalUrl)

    // Generate categorization using OpenAI
    const prompt = buildCategorizerPrompt(productData)
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a product categorization expert. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}')

    // Generate embedding for the product
    const embeddingText = extractEmbeddingText(productData, analysis)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: embeddingText,
    })
    const embedding = embeddingResponse.data[0].embedding

    // Verify vendor has active subscription
    const vendor = await prisma.vendor.findUnique({ where: { userId: user.id } })
    if (!vendor || !isActiveSubscriptionStatus(vendor.subscriptionStatus)) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 402 })
    }

    // Find existing product or create new one
    let product = await prisma.product.findFirst({
      where: { affiliateUrl: cleanedUrl }
    })

    if (product) {
      // Update existing product
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          title: productData.title,
          description: productData.description,
          price: productData.price,
          images: productData.images,
          categories: analysis.categories || [],
          embedding: embedding,
          vendorEmail: productData.vendorEmail || vendor.email,
          vendorId: vendor.id,
          status: 'PENDING', // Products start as pending for moderation
        },
      })
    } else {
      // Create new product
      product = await prisma.product.create({
        data: {
          title: productData.title,
          description: productData.description,
          price: productData.price,
          images: productData.images,
          affiliateUrl: cleanedUrl,
          categories: analysis.categories || [],
          embedding: embedding,
          vendorEmail: productData.vendorEmail || vendor.email,
          vendorId: vendor.id,
          status: 'PENDING',
        },
      })
    }

    return NextResponse.json({
      success: true,
      productId: product.id,
      categories: product.categories,
      status: product.status,
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