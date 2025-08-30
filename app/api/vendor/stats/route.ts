import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
	try {
		const supabase = createSupabaseServerClient()
		const { data: { user }, error } = await supabase.auth.getUser()
		if (error || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const vendor = await prisma.vendor.findUnique({ where: { userId: user.id } })
		if (!vendor) {
			return NextResponse.json({ products: [], totals: { products: 0, saves: 0 }, vendor: { subscriptionStatus: 'INACTIVE', currentPeriodEnd: null } })
		}

		const products = await prisma.product.findMany({ where: { vendorId: vendor.id }, select: { id: true, title: true } })
		const productIds = products.map(p => p.id)
		if (productIds.length === 0) {
			return NextResponse.json({ products: [], totals: { products: 0, saves: 0 }, vendor: { subscriptionStatus: vendor.subscriptionStatus, currentPeriodEnd: vendor.currentPeriodEnd?.toISOString() || null } })
		}

		const grouped = await prisma.swipe.groupBy({
			by: ['productId'],
			where: { productId: { in: productIds }, action: 'SAVED' },
			_count: { _all: true },
		})

		const idToSaves: Record<string, number> = {}
		for (const g of grouped) {
			idToSaves[g.productId] = (g as any)._count?._all ?? 0
		}

		const withCounts = products.map(p => ({ id: p.id, title: p.title, savesCount: idToSaves[p.id] ?? 0 }))
		const totalSaves = withCounts.reduce((sum, p) => sum + p.savesCount, 0)

		return NextResponse.json({ products: withCounts, totals: { products: products.length, saves: totalSaves }, vendor: { subscriptionStatus: vendor.subscriptionStatus, currentPeriodEnd: vendor.currentPeriodEnd?.toISOString() || null } })
	} catch (err: any) {
		console.error('Stats error:', err)
		return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
	}
}