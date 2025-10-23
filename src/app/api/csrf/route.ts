import { NextResponse } from 'next/server'
import { generateCsrfToken } from '@/lib/csrf'

export async function GET(): Promise<NextResponse> {
  try {
    const token = generateCsrfToken()

    return NextResponse.json(
      { csrfToken: token },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
        },
      }
    )
  } catch (error) {
    console.error('Error generating CSRF token:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
