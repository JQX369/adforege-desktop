import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

function isAdmin(email: string | null | undefined) {
	const admins = (process.env.INGEST_ADMINS || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
	if (!admins.length) return false
	return email ? admins.includes(email) : false
}

export async function GET(req: NextRequest) {
	try {
		const supabase = createSupabaseServerClient()
		const { data: { user }, error } = await supabase.auth.getUser()
		if (error || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const vendor = await prisma.vendor.findUnique({ where: { userId: user.id } })
		const adminFlag = isAdmin(user.email)
		if (!vendor) {
			return NextResponse.json({
				products: [],
				totals: { products: 0, impressions: 0, clicks: 0, saves: 0 },
				rates: { ctr: 0, saveRate: 0 },
				topProducts: [],
				vendor: { subscriptionStatus: 'INACTIVE', currentPeriodEnd: null, plan: 'BASIC' },
				metricsWindowDays: Number(process.env.DASHBOARD_WINDOW_DAYS || 7),
				isAdmin: adminFlag,
			})
		}

		const products = await prisma.product.findMany({
			where: { vendorId: vendor.id },
			select: { id: true, title: true, images: true, price: true, currency: true },
		})
		const productIds = products.map((p) => p.id)
		const windowDays = Number(process.env.DASHBOARD_WINDOW_DAYS || 7)
		const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

		if (productIds.length === 0) {
			return NextResponse.json({
				products: [],
				totals: { products: 0, impressions: 0, clicks: 0, saves: 0 },
				rates: { ctr: 0, saveRate: 0 },
				topProducts: [],
				metricsWindowDays: windowDays,
				vendor: {
					subscriptionStatus: vendor.subscriptionStatus,
					currentPeriodEnd: vendor.currentPeriodEnd?.toISOString() || null,
					plan: vendor.plan,
				},
				isAdmin: adminFlag,
			})
		}

		const eventGroups = await prisma.recommendationEvent.groupBy({
			by: ['productId', 'action'],
			where: {
				productId: { in: productIds },
				createdAt: { gte: since },
			},
			_count: { _all: true },
		})

		const actionTotals: Record<string, number> = { impressions: 0, clicks: 0, saves: 0, likes: 0 }
		const perProduct: Record<string, { impressions: number; clicks: number; saves: number; likes: number }> = {}

		for (const group of eventGroups) {
			if (!group.productId) continue
			const current = perProduct[group.productId] || { impressions: 0, clicks: 0, saves: 0, likes: 0 }
			switch (group.action) {
				case 'IMPRESSION':
					current.impressions += group._count._all
					actionTotals.impressions += group._count._all
					break
				case 'CLICK':
					current.clicks += group._count._all
					actionTotals.clicks += group._count._all
					break
				case 'SAVE':
					current.saves += group._count._all
					actionTotals.saves += group._count._all
					break
				case 'LIKE':
					current.likes += group._count._all
					actionTotals.likes += group._count._all
					break
			}
			perProduct[group.productId] = current
		}

		const productMetrics = products.map((product) => {
			const metrics = perProduct[product.id] || { impressions: 0, clicks: 0, saves: 0, likes: 0 }
			const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0
			const saveRate = metrics.impressions > 0 ? metrics.saves / metrics.impressions : 0
			return {
				id: product.id,
				title: product.title,
				imageUrl: product.images?.[0] || '',
				price: product.price,
				currency: product.currency,
				...metrics,
				ctr,
				saveRate,
			}
		})

		const totals = {
			products: products.length,
			impressions: actionTotals.impressions,
			clicks: actionTotals.clicks,
			saves: actionTotals.saves,
		}
		const rates = {
			ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
			saveRate: totals.impressions > 0 ? totals.saves / totals.impressions : 0,
		}

		const topProducts = productMetrics
			.filter((p) => p.impressions > 0)
			.sort((a, b) => b.impressions - a.impressions)
			.slice(0, 5)

		return NextResponse.json({
			products: productMetrics,
			totals,
			rates,
			metricsWindowDays: windowDays,
			vendor: {
				plan: vendor.plan,
				subscriptionStatus: vendor.subscriptionStatus,
				currentPeriodEnd: vendor.currentPeriodEnd?.toISOString() || null,
			},
			topProducts,
			isAdmin: adminFlag,
		})
	} catch (err: any) {
		console.error('Stats error:', err)
		return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
	}
}