import { NextRequest, NextResponse } from 'next/server'
import { buildAffiliateUrlWithLocale } from '@/lib/affiliates'
import { prisma } from '@/lib/prisma'
import { logError, logInfo } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawUrl = searchParams.get('url')
    const productId = searchParams.get('pid') || undefined
    const country = searchParams.get('cc') || undefined
    const sessionId = searchParams.get('sid') || undefined
    const userId = searchParams.get('u') || undefined

    if (!rawUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      )
    }

    // Ignore placeholder links
    if (rawUrl === '#' || rawUrl === 'about:blank') {
      return NextResponse.json(
        { error: 'No external link for this item' },
        { status: 400 }
      )
    }

    const target = buildAffiliateUrlWithLocale(rawUrl, country)
    logInfo('Redirecting affiliate click', {
      productId,
      rawUrl,
      country,
      sessionId,
      userId,
    })
    try {
      await prisma.clickEvent.create({
        data: {
          sessionId: sessionId || null,
          userId: userId || null,
          productId: productId || null,
          targetUrl: target,
        },
      })
    } catch (e) {
      logError('ClickEvent create failed', { error: e })
    }
    return NextResponse.redirect(target, { status: 302 })
  } catch (error) {
    logError('Redirector error', { error })
    return NextResponse.json({ error: 'Failed to redirect' }, { status: 500 })
  }
}
