import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { SessionProfile, SessionConstraints } from './types'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function buildSessionProfile(sessionId: string, text: string, constraints: SessionConstraints): Promise<SessionProfile> {
  let embedding: number[] | null = null
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 1500),
    })
    embedding = response.data[0]?.embedding ?? null
  } catch (error) {
    console.log('[recs][session] embedding generation failed', error)
  }

  try {
    await prisma.sessionProfile.upsert({
      where: { sessionId },
      create: {
        sessionId,
        embedding: embedding ?? [],
        constraints,
      },
      update: {
        embedding: embedding ?? [],
        constraints,
        updatedAt: new Date(),
      },
    })
  } catch (error) {
    console.log('[recs][session] failed to persist session profile', error)
  }

  return { sessionId, embedding, constraints }
}

export async function loadSessionProfile(sessionId: string): Promise<SessionProfile | null> {
  try {
    const record = await prisma.sessionProfile.findUnique({ where: { sessionId } })
    if (!record) return null
    return {
      sessionId,
      embedding: record.embedding ?? [],
      constraints: (record.constraints as SessionConstraints) || { interests: [], excludeIds: [], seenIds: [] },
    }
  } catch (error) {
    console.log('[recs][session] load failed', error)
    return null
  }
}

export async function appendSeenIds(sessionId: string, productIds: string[]): Promise<void> {
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


