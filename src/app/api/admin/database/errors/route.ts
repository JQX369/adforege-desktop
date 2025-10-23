import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(): Promise<NextResponse> {
  try {
    const connectionErrors = db.getConnectionErrorsReport()

    return NextResponse.json(connectionErrors, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Failed to get connection errors report:', error)
    return NextResponse.json(
      {
        error: 'Failed to get connection errors report',
        errors: [],
      },
      { status: 500 }
    )
  }
}
