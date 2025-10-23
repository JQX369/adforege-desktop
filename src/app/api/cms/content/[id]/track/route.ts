import { NextRequest, NextResponse } from 'next/server'
import { ContentManager } from '@/src/features/cms/content-manager'
import { withErrorHandling } from '@/lib/api-error-handler'

export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const body = await request.json()
    const { action } = body

    const contentManager = new ContentManager()

    switch (action) {
      case 'view':
        await contentManager.trackContentView(params.id)
        break
      case 'like':
        await contentManager.trackContentLike(params.id)
        break
      case 'share':
        await contentManager.trackContentShare(params.id)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }
)
