import 'dotenv/config'

import { Prisma, PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const prisma = new PrismaClient()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

interface EnrichmentPayload {
  shortDescription?: string
  tags?: string[]
  personaTags?: string[]
  occasions?: string[]
  summary?: string
  highlights?: string[]
}

async function fetchProducts(limit: number, force: boolean) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const where: Prisma.ProductWhereInput = force
    ? { status: 'APPROVED' }
    : {
        status: 'APPROVED',
        OR: [
          { lastEnrichedAt: null },
          { lastEnrichedAt: { lt: fourteenDaysAgo } },
          { tags: { none: {} } },
        ],
      }

  return prisma.product.findMany({
    where,
    orderBy: { lastEnrichedAt: 'asc' },
    include: { tags: true, embeddings: true },
    take: limit,
  })
}

async function generateEnrichment(product: { title: string; description: string; features: string[] }) {
  const systemPrompt = `You are a product enrichment assistant. Respond ONLY with strict JSON.`
  const userPrompt = `Create enrichment details for this product.
Title: ${product.title}
Description: ${product.description}
Features: ${(product.features || []).join('; ')}

Return JSON with keys: shortDescription (string, <=160 chars), tags (array of short keywords), personaTags (array of user personas, e.g. "techie", "home cook"), occasions (array), summary (2 sentence summary), highlights (array of bullets).`

  const response = await openai.responses.create({
    model: process.env.OPENAI_GIFT_MODEL || 'gpt-4.1-mini',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
  })

  const text = response.output_text?.trim() || ''
  if (!text) return null

  try {
    const parsed = JSON.parse(text) as EnrichmentPayload
    return parsed
  } catch (error) {
    console.error('[enrich] Failed to parse JSON', text, error)
    return null
  }
}

async function generateEmbedding(text: string) {
  if (!text) return null
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 1500),
    })
    return embeddingResponse.data[0]?.embedding ?? null
  } catch (error) {
    console.error('[enrich] embedding failed', error)
    return null
  }
}

async function enrichProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { tags: true, embeddings: true },
  })

  if (!product) return

  const enrichment = await generateEnrichment(product)
  if (!enrichment) return

  const summaryForEmbedding = enrichment.summary || `${product.title} ${enrichment.shortDescription ?? ''}`
  const embedding = await generateEmbedding(summaryForEmbedding)

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        shortDescription: enrichment.shortDescription?.slice(0, 200) || product.shortDescription,
        features: enrichment.highlights && enrichment.highlights.length ? enrichment.highlights : product.features,
        lastEnrichedAt: new Date(),
      },
    })

    await tx.productTag.deleteMany({ where: { productId } })

    const tagsToCreate = new Set<string>()
    for (const tag of enrichment.tags || []) tagsToCreate.add(tag)
    for (const tag of enrichment.personaTags || []) tagsToCreate.add(tag)
    for (const tag of enrichment.occasions || []) tagsToCreate.add(tag)

    if (tagsToCreate.size) {
      await tx.productTag.createMany({
        data: Array.from(tagsToCreate).map((tag) => ({ productId, tag, weight: 1 })),
        skipDuplicates: true,
      })
    }

    if (embedding) {
      await tx.productEmbedding.upsert({
        where: { productId },
        update: { embedding, updatedAt: new Date() },
        create: { productId, embedding },
      })
    }
  })
}

async function main() {
  const limitArgRaw = process.argv.find((arg) => arg.startsWith('--limit='))?.replace('--limit=', '')
  const limitArg = limitArgRaw ? Number(limitArgRaw) : NaN
  const take = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 20
  const force = process.argv.includes('--force')

  const products = await fetchProducts(take, force)
  if (!products.length) {
    console.log('No products require enrichment ✅')
    return
  }

  console.log(`Enriching ${products.length} products...`)

  for (const product of products) {
    console.log(`→ Enriching ${product.title.slice(0, 60)}...`)
    try {
      await enrichProduct(product.id)
      console.log('   ✓ done')
    } catch (error) {
      console.error(`   ✗ failed:`, error)
    }
  }
}

main()
  .catch((error) => {
    console.error('Enrichment script crashed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


