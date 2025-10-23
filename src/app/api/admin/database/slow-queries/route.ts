import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(): Promise<NextResponse> {
  try {
    const slowQueries = db.getSlowQueriesReport()

    return NextResponse.json(slowQueries, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Failed to get slow queries report:', error)
    return NextResponse.json(
      {
        error: 'Failed to get slow queries report',
        queries: [],
      },
      { status: 500 }
    )
  }
}
