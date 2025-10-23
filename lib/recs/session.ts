import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { Prisma } from '@prisma/client'
import { SessionProfile, SessionConstraints } from './types'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function buildSessionProfile(
  sessionId: string,
  text: string,
  constraints: SessionConstraints
): Promise<SessionProfile> {
  console.log('🔍 [DEBUG] buildSessionProfile called:', {
    sessionId,
    textLength: text.length,
    textPreview: text.substring(0, 100),
    constraintsKeys: Object.keys(constraints),
  })

  // Debug 6: Check OpenAI API key
  console.log('🔍 [DEBUG] OpenAI API key check:', {
    hasApiKey: !!process.env.OPENAI_API_KEY,
    keyLength: process.env.OPENAI_API_KEY?.length || 0,
    keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 20) || 'N/A',
  })

  let embedding: number[] | null = null
  try {
    console.log('🔍 [DEBUG] Creating OpenAI embedding...')
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 1500),
    })
    embedding = response.data[0]?.embedding ?? null
    console.log('🔍 [DEBUG] Embedding created:', {
      hasEmbedding: !!embedding,
      embeddingLength: embedding?.length || 0,
    })
  } catch (error) {
    console.error('🔍 [DEBUG] Embedding generation failed:', {
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorType: error?.type,
    })
    console.log('[recs][session] embedding generation failed', error)
  }

  // Debug 7: Check database connection and table existence
  try {
    console.log('🔍 [DEBUG] Checking database connection...')
    await prisma.$queryRaw`SELECT 1`
    console.log('🔍 [DEBUG] Database connection successful')

    console.log('🔍 [DEBUG] Checking SessionProfile table...')
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SessionProfile'
      );
    `
    console.log('🔍 [DEBUG] SessionProfile table exists:', tableExists)
  } catch (error) {
    console.error('🔍 [DEBUG] Database check failed:', error)
  }

  try {
    console.log('🔍 [DEBUG] Upserting session profile...')
    await prisma.sessionProfile.upsert({
      where: { sessionId },
      create: {
        sessionId,
        embedding: embedding ?? [],
        constraints: constraints as unknown as Prisma.InputJsonValue,
      },
      update: {
        embedding: embedding ?? [],
        constraints: constraints as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
    console.log('🔍 [DEBUG] Session profile upserted successfully')
  } catch (error) {
    console.error('🔍 [DEBUG] Session profile upsert failed:', {
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorMeta: error?.meta,
    })
    console.log('[recs][session] failed to persist session profile', error)
  }

  return { sessionId, embedding, constraints }
}

export async function loadSessionProfile(
  sessionId: string
): Promise<SessionProfile | null> {
  try {
    const record = await prisma.sessionProfile.findUnique({
      where: { sessionId },
    })
    if (!record) return null
    return {
      sessionId,
      embedding: record.embedding ?? [],
      constraints: (record.constraints as unknown as SessionConstraints) || {
        interests: [],
        excludeIds: [],
        seenIds: [],
      },
    }
  } catch (error) {
    console.log('[recs][session] load failed', error)
    return null
  }
}

export async function appendSeenIds(
  sessionId: string,
  productIds: string[]
): Promise<void> {
  if (!productIds.length) return
  try {
    await prisma.sessionProfile.update({
      where: { sessionId },
      data: {
        seen: {
          push: productIds,
        },
        updatedAt: new Date(),
      },
    })
  } catch (error) {
    console.log('[recs][session] appendSeenIds failed', error)
  }
}
