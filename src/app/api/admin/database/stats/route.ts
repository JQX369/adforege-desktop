import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(): Promise<NextResponse> {
  try {
    const stats = db.getStatistics()

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Failed to get database statistics:', error)
    return NextResponse.json(
      {
        error: 'Failed to get database statistics',
        totalQueries: 0,
        averageQueryTime: 0,
        slowestQuery: null,
        errorRate: 0,
      },
      { status: 500 }
    )
  }
}
