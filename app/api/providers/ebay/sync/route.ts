import { NextRequest, NextResponse } from 'next/server'
import { syncEbayByKeyword } from '@/lib/providers/ebay'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')
    const isCron = auth === `Bearer ${process.env.CRON_SECRET}`
    if (!isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({})) as { keyword?: string }
    const keyword = body.keyword || 'gift ideas'
    const result = await syncEbayByKeyword(keyword)
    return NextResponse.json({ ok: true, keyword, ...result })
  } catch (e: any) {
    console.error('eBay sync error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


