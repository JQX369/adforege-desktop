import { NextRequest, NextResponse } from 'next/server'
import { MLTrainingManager } from '@/scripts/ml-training'

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Starting ML model training...')

    const manager = new MLTrainingManager()
    const results = await manager.trainAllModels()

    console.log('✅ ML training completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Models trained successfully',
      results: results.map((result) => ({
        model: result.model,
        accuracy: result.accuracy,
        trainingTime: result.trainingTime,
        dataSize: result.dataSize,
      })),
    })
  } catch (error) {
    console.error('❌ ML training failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Training failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
