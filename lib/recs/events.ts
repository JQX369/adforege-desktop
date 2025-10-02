import { PrismaClient, RecommendationAction } from '@prisma/client'

const prisma = new PrismaClient()

interface ImpressionPayload {
  sessionId: string
  userId?: string
  productIds: string[]
  metadata?: Record<string, unknown>
}

export async function logImpressions({ sessionId, userId, productIds }: ImpressionPayload): Promise<void> {
  if (!productIds.length) return

  try {
    await prisma.recommendationEvent.createMany({
      data: productIds.map((productId) => ({
        sessionId,
        userId: userId ?? null,
        productId,
        action: RecommendationAction.IMPRESSION,
      })),
    })
  } catch (error) {
    console.log('[recs][events] logImpressions failed', error)
  }
}

interface EventPayload {
  sessionId?: string
  userId?: string
  productId?: string
  metadata?: Record<string, unknown>
}

export async function logClick(payload: EventPayload): Promise<void> {
  await logEvent({ ...payload, action: RecommendationAction.CLICK })
}

export async function logSave(payload: EventPayload): Promise<void> {
  await logEvent({ ...payload, action: RecommendationAction.SAVE })
}

export async function logDislike(payload: EventPayload): Promise<void> {
  await logEvent({ ...payload, action: RecommendationAction.DISLIKE })
}

export async function logLike(payload: EventPayload): Promise<void> {
  await logEvent({ ...payload, action: RecommendationAction.LIKE })
}

async function logEvent({ sessionId, userId, productId, metadata, action }: EventPayload & { action: RecommendationAction }) {
  try {
    await prisma.recommendationEvent.create({
      data: {
        sessionId: sessionId ?? null,
        userId: userId ?? null,
        productId: productId ?? null,
        action,
        metadata: metadata ?? null,
      },
    })
  } catch (error) {
    console.log(`[recs][events] ${action} log failed`, error)
  }
}

