import { NextRequest, NextResponse } from 'next/server'
import { ContentManager } from '@/src/features/cms/content-manager'
import { withErrorHandling } from '@/lib/api-error-handler'

export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const contentManager = new ContentManager()
    const content = await contentManager.getContent(params.id)

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    return NextResponse.json(content)
  }
)

export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const body = await request.json()

    const contentManager = new ContentManager()
    const content = await contentManager.updateContent({
      id: params.id,
      ...body,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    })

    return NextResponse.json(content)
  }
)

export const DELETE = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const contentManager = new ContentManager()
    await contentManager.deleteContent(params.id)

    return NextResponse.json({ success: true })
  }
)
