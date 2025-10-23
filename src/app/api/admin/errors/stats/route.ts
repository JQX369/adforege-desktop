import { NextResponse } from 'next/server'
import { errorHandler } from '@/lib/error-handler'

export async function GET(): Promise<NextResponse> {
  try {
    const stats = errorHandler.getErrorStatistics()

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Failed to get error statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get error statistics' },
      { status: 500 }
    )
  }
}
