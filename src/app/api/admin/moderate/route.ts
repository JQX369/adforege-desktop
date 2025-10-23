import { NextRequest, NextResponse } from 'next/server'
import { ProductStatus } from '@prisma/client'
import { assertAdmin, AdminAuthError } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    await assertAdmin(req)

    const { productId, action, updates } = await req.json()
    if (!productId || !action)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!['APPROVE', 'REJECT', 'UPDATE'].includes(action))
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    if (action === 'UPDATE') {
      await prisma.product.update({
        where: { id: productId },
        data: updates || {},
      })
      return NextResponse.json({ ok: true })
    }

    const status =
      action === 'APPROVE' ? ProductStatus.APPROVED : ProductStatus.REJECTED
    await prisma.product.update({ where: { id: productId }, data: { status } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('Moderate error:', e)
    return NextResponse.json(
      { error: e?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
