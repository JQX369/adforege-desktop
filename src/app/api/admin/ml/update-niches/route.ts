import { NextRequest, NextResponse } from 'next/server'
import { NicheDetector } from '@/src/features/ml/niche-detector'

export async function POST(req: NextRequest) {
  try {
    console.log('🎯 Updating niche profiles...')

    const nicheDetector = new NicheDetector()
    await nicheDetector.updateNicheProfiles()

    console.log('✅ Niche profiles updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Niche profiles updated successfully',
    })
  } catch (error) {
    console.error('❌ Niche update failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Niche update failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
