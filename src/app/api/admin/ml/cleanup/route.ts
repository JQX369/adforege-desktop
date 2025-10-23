import { NextRequest, NextResponse } from 'next/server'
import { MLTrainingManager } from '@/scripts/ml-training'

export async function POST(req: NextRequest) {
  try {
    console.log('🧹 Starting data cleanup...')

    const manager = new MLTrainingManager()
    await manager.cleanupOldData()

    console.log('✅ Data cleanup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Data cleanup completed successfully',
    })
  } catch (error) {
    console.error('❌ Data cleanup failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Data cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
