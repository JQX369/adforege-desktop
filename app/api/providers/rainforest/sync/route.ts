import { NextRequest, NextResponse } from 'next/server'
import { syncRainforestByKeyword } from '@/lib/providers/rainforest'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')
    const isCron = auth === `Bearer ${process.env.CRON_SECRET}`
    if (!isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({})) as { keyword?: string, country?: string }
    const keyword = body.keyword || 'gift ideas'
    const country = body.country || 'US'
    const result = await syncRainforestByKeyword(keyword, country)
    return NextResponse.json({ ok: true, keyword, country, ...result })
  } catch (e: any) {
    console.error('Rainforest sync error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


