import { NextRequest, NextResponse } from 'next/server'
import { syncRainforestByKeyword } from '@/lib/providers/rainforest'
import { syncEbayByKeyword } from '@/lib/providers/ebay'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')
    const isCron = auth === `Bearer ${process.env.CRON_SECRET}`
    if (!isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { amazon = [], ebay = [], country = 'US' } = await req.json().catch(async () => {
      try {
        const seeds = await (await fetch(new URL('/config/providers-seed.json', new URL(req.url).origin))).json()
        return { ...seeds, country: 'US' }
      } catch {
        return { amazon: [], ebay: [], country: 'US' }
      }
    })

    const results: any = { amazon: [], ebay: [] }
    for (const kw of amazon) {
      const r = await syncRainforestByKeyword(kw, country)
      results.amazon.push({ keyword: kw, ...r })
    }
    for (const kw of ebay) {
      const r = await syncEbayByKeyword(kw)
      results.ebay.push({ keyword: kw, ...r })
    }
    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    console.error('sync-all error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


