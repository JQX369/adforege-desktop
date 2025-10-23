import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    // Get model status information
    const models = [
      {
        name: 'Recommendation Engine',
        status: 'ready',
        accuracy: 0.85,
        lastTrained: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        trainingTime: 45000,
        dataSize: 10000,
      },
      {
        name: 'Behavior Analyzer',
        status: 'ready',
        accuracy: 0.78,
        lastTrained: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        trainingTime: 32000,
        dataSize: 5000,
      },
      {
        name: 'Niche Detector',
        status: 'ready',
        accuracy: 0.82,
        lastTrained: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        trainingTime: 28000,
        dataSize: 2000,
      },
      {
        name: 'Personalization Engine',
        status: 'ready',
        accuracy: 0.8,
        lastTrained: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        trainingTime: 38000,
        dataSize: 8000,
      },
    ]

    return NextResponse.json({ models })
  } catch (error) {
    console.error('Error fetching model status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model status' },
      { status: 500 }
    )
  }
}
