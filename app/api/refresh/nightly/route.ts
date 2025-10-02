import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, AvailabilityStatus } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    // Check CRON_SECRET for cron job invocations (Vercel adds this automatically)
    const auth = req.headers.get('Authorization')
    const isCronJob = auth === `Bearer ${process.env.CRON_SECRET}`

    // Optional admin guard: require an admin when called manually; allow cron without user
    if (!isCronJob) {
      const supabase = createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      const admins = (process.env.INGEST_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean)
      if (user && admins.length > 0 && !admins.includes(user.email || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const products = await prisma.product.findMany({
      where: { status: 'APPROVED' },
      take: 1000,
      orderBy: { updatedAt: 'desc' as any }
    } as any)

    const now = new Date()
    let count = 0
    for (const p of products) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          lastSeenAt: now,
          availability: p.availability || AvailabilityStatus.UNKNOWN,
        }
      })
      count++
    }
    return NextResponse.json({ ok: true, updated: count })
  } catch (e: any) {
    console.error('Nightly refresh error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}



