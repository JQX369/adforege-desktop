import { NextRequest, NextResponse } from 'next/server'
import { errorHandler } from '@/lib/error-handler'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params
    const body = await request.json()
    const { notes } = body

    const success = errorHandler.resolveError(id, 'admin', notes)

    if (!success) {
      return NextResponse.json({ error: 'Error not found' }, { status: 404 })
    }

    return NextResponse.json(
      { message: 'Error resolved successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to resolve error:', error)
    return NextResponse.json(
      { error: 'Failed to resolve error' },
      { status: 500 }
    )
  }
}
