import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admins = (process.env.INGEST_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!user || (admins.length > 0 && !admins.includes(user.email || ''))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [recs, clicks, products] = await Promise.all([
      prisma.recommendLog.count(),
      prisma.clickEvent.count(),
      prisma.product.count({ where: { status: 'APPROVED' } }),
    ])
    const ctr = recs > 0 ? (clicks / recs) : 0
    const last20 = await prisma.recommendLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
    return NextResponse.json({ recs, clicks, ctr, approvedProducts: products, last: last20 })
  } catch (e: any) {
    console.error('metrics error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


