import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, ProductStatus } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admins = (process.env.INGEST_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!user || (admins.length > 0 && !admins.includes(user.email || ''))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId, action, updates } = await req.json()
    if (!productId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!['APPROVE','REJECT','UPDATE'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    if (action === 'UPDATE') {
      await prisma.product.update({ where: { id: productId }, data: updates || {} })
      return NextResponse.json({ ok: true })
    }

    const status = action === 'APPROVE' ? ProductStatus.APPROVED : ProductStatus.REJECTED
    await prisma.product.update({ where: { id: productId }, data: { status } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Moderate error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


