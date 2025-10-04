import { NextRequest, NextResponse } from 'next/server'
import { AvailabilityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertAdmin, AdminAuthError } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')
    const isCronJob = auth === `Bearer ${process.env.CRON_SECRET}`

    if (!isCronJob) {
      await assertAdmin(req)
    }

    const products = await prisma.product.findMany({
      where: { status: 'APPROVED' },
      take: 1000,
      orderBy: { updatedAt: 'desc' },
    })

    const now = new Date()
    let count = 0
    for (const p of products) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          lastSeenAt: now,
          availability: p.availability || AvailabilityStatus.UNKNOWN,
        },
      })
      count += 1
    }

    return NextResponse.json({ count })
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('nightly refresh error:', error)
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}



