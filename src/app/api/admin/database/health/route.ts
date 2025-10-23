import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(): Promise<NextResponse> {
  try {
    const healthStatus = await db.getHealthStatus()

    return NextResponse.json(healthStatus, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('Database health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Failed to check database health',
        connectionCount: 0,
        activeQueries: 0,
        slowQueries: 0,
        recentErrors: 1,
        responseTime: 0,
      },
      { status: 500 }
    )
  }
}
