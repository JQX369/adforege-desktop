'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'

type ProductMetric = {
	id: string
	title: string
	imageUrl?: string
	price?: number
	currency?: string
	impressions: number
	clicks: number
	saves: number
	likes: number
	ctr: number
	saveRate: number
}

interface VendorStats {
	products: ProductMetric[]
	totals: { products: number; impressions: number; clicks: number; saves: number }
	rates: { ctr: number; saveRate: number }
	metricsWindowDays: number
	topProducts?: ProductMetric[]
	vendor?: { subscriptionStatus: string; currentPeriodEnd?: string | null; plan?: string | null }
}

export default function VendorDashboardPage() {
	const router = useRouter()
	const supabase = createSupabaseBrowserClient()
	const [loading, setLoading] = useState(true)
	const [stats, setStats] = useState<VendorStats | null>(null)
	const [portalLoading, setPortalLoading] = useState(false)

	useEffect(() => {
		const checkAuth = async () => {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) {
				router.push('/auth/sign-in?redirect=/vendor/dashboard')
				return
			}

			try {
				const res = await fetch('/api/vendor/stats')
				if (res.ok) {
					const data = await res.json()
					setStats(data)
				}
			} catch (error) {
				console.error('Failed to fetch stats:', error)
			} finally {
				setLoading(false)
			}
		}
		checkAuth()
	}, [router, supabase])

	const [portalError, setPortalError] = useState<string>('')

	const openPortal = async () => {
		setPortalLoading(true)
		setPortalError('')
		try {
			const res = await fetch('/api/vendor/portal', { method: 'POST' })
			const data = await res.json()
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
			if (data?.url) {
				window.location.href = data.url
			}
		} catch (e: any) {
			setPortalError(e.message || 'Failed to open portal')
		} finally {
			setPortalLoading(false)
		}
	}

	return (
		<main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
			{/* Animated background */}
			<div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
			<div className="absolute top-20 right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
			<div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
			
			<div className="container mx-auto px-4 py-12 space-y-8 relative z-10">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-4xl font-bold text-white mb-2">Vendor Dashboard</h1>
						<p className="text-purple-200">Manage your products and track performance</p>
					</div>
					<div className="space-y-2">
						<Button 
							onClick={openPortal} 
							disabled={portalLoading}
							className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
						>
							{portalLoading ? 'Opening…' : '💳 Manage Billing'}
						</Button>
						{portalError && (
							<div className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
								{portalError}
							</div>
						)}
					</div>
				</div>

				{stats?.vendor && (
					<Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
						<CardHeader>
							<CardTitle className="text-white flex items-center gap-2">
								<span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
								Subscription Status
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-6">
								<div className="text-center">
									<div className="text-sm text-purple-200 mb-1">Status</div>
									<div className="text-2xl font-bold text-green-400">{stats.vendor.subscriptionStatus}</div>
								</div>
								<div className="text-center">
									<div className="text-sm text-purple-200 mb-1">Next billing</div>
									<div className="text-lg font-semibold text-white">{stats.vendor.currentPeriodEnd ? new Date(stats.vendor.currentPeriodEnd).toLocaleDateString() : '—'}</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				<div className="grid md:grid-cols-2 gap-8">
					<Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
						<CardHeader>
							<CardTitle className="text-white flex items-center gap-2">
								📊 Overview
							</CardTitle>
						</CardHeader>
						<CardContent>
							{loading ? (
								<div className="text-purple-200">Loading…</div>
							) : stats ? (
								<div className="grid grid-cols-2 gap-6">
									<div className="text-center">
										<div className="text-4xl font-bold text-blue-400 mb-2">{stats.totals.products}</div>
										<div className="text-purple-200">Products</div>
									</div>
									<div className="text-center">
										<div className="text-4xl font-bold text-pink-400 mb-2">{stats.totals.saves}</div>
										<div className="text-purple-200">Total Saves</div>
									</div>
								</div>
							) : (
								<div className="text-purple-200">No data.</div>
							)}
						</CardContent>
					</Card>

					<Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
						<CardHeader>
							<CardTitle className="text-white flex items-center gap-2">
							🎁 Your Products
							</CardTitle>
						</CardHeader>
						<CardContent>
						{stats && stats.products.length > 0 ? (
								<div className="space-y-3">
								{stats.products.map(p => (
									<div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 gap-3">
										<span className="text-white font-medium truncate">{p.title}</span>
										<div className="flex items-center gap-2">
											<span className="text-purple-300 text-sm bg-purple-500/20 px-2 py-1 rounded-full">❤️ {p.savesCount}</span>
											<Button size="sm" variant="outline" onClick={async () => {
												try {
													await fetch('/api/admin/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, action: 'APPROVE' }) })
													window.location.reload()
												} catch {}
											}}>Approve</Button>
											<Button size="sm" variant="destructive" onClick={async () => {
												try {
													await fetch('/api/admin/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, action: 'REJECT' }) })
													window.location.reload()
												} catch {}
											}}>Reject</Button>
										</div>
									</div>
								))}
								</div>
							) : (
								<div className="text-purple-200 text-center py-8">
									<div className="text-4xl mb-2">📦</div>
									You have no products yet.
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Moderation stub to prepare UI space for admin tools */}
				<Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
					<CardHeader>
						<CardTitle className="text-white flex items-center gap-2">🛡️ Moderation & Ingestion</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-purple-200 mb-4">Paste product URLs (one per line) to ingest without CSV.</div>
						<BulkUrlIngestForm />
					</CardContent>
				</Card>

						<MetricsPanel />

				<Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
					<CardHeader>
						<CardTitle className="text-white flex items-center gap-2">
							🚀 Submit a Product
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ProductSubmissionForm />
					</CardContent>
				</Card>
			</div>
		</main>
	)
}

function ProductSubmissionForm() {
	const [url, setUrl] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!url.trim()) return

		setSubmitting(true)
		setMessage(null)
		try {
			const res = await fetch('/api/categorise-product', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url })
			})
			
			if (res.ok) {
				setMessage({ type: 'success', text: 'Product submitted successfully!' })
				setUrl('')
			} else {
				const error = await res.json()
				setMessage({ type: 'error', text: error.message || 'Failed to submit product' })
			}
		} catch (error) {
			setMessage({ type: 'error', text: 'Failed to submit product' })
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{message && (
				<div className={`text-sm rounded px-3 py-2 border ${
					message.type === 'success' 
						? 'text-green-300 bg-green-500/10 border-green-500/30' 
						: 'text-red-300 bg-red-500/10 border-red-500/30'
				}`}>
					{message.text}
				</div>
			)}
			<Input 
				type="url"
				className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-purple-400" 
				placeholder="Product URL (e.g., https://example.com/product)" 
				value={url} 
				onChange={e => setUrl(e.target.value)}
				required
			/>
			<Button 
				type="submit"
				disabled={submitting || !url.trim()}
				className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
			>
				{submitting ? '⏳ Submitting…' : '🎁 Submit Product'}
			</Button>
		</form>
	)
}

function BulkUrlIngestForm() {
    const [urls, setUrls] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState<any>(null)
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const list = urls
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean)
        if (list.length === 0) return
        setSubmitting(true)
        setResult(null)
        try {
            const res = await fetch('/api/admin/ingest/urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: list })
            })
            const data = await res.json()
            setResult(data)
        } catch (e) {
            setResult({ error: (e as any)?.message || 'Failed' })
        } finally {
            setSubmitting(false)
        }
    }
    return (
        <form onSubmit={onSubmit} className="space-y-3">
            <Textarea
                placeholder={`https://www.amazon.com/dp/B0...\nhttps://www.etsy.com/listing/...`}
                value={urls}
                onChange={e => setUrls(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 min-h-[160px]"
            />
            <Button type="submit" disabled={submitting || urls.trim().length === 0} className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white">
                {submitting ? 'Ingesting…' : 'Ingest URLs'}
            </Button>
            {result && (
                <div className="text-xs text-purple-200 whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                </div>
            )}
        </form>
    )
}

function MetricsPanel() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)

    useEffect(() => {
        const run = async () => {
            try {
                const res = await fetch('/api/admin/metrics')
                if (res.ok) setData(await res.json())
            } finally { setLoading(false) }
        }
        run()
    }, [])

    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">Insights (last {data?.metricsWindowDays ?? 7} days)</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && <div className="text-purple-200">Loading…</div>}
                    {!loading && !data && <div className="text-purple-200">No data.</div>}
                    {!loading && data && (
                        <div className="grid grid-cols-2 gap-4 text-sm text-purple-200">
                            <MetricTile label="Impressions" value={data.totals?.impressions ?? 0} />
                            <MetricTile label="Clicks" value={data.totals?.clicks ?? 0} />
                            <MetricTile label="Saves" value={data.totals?.saves ?? 0} />
                            <MetricTile label="CTR" value={`${((data.rates?.ctr ?? 0) * 100).toFixed(2)}%`} />
                            <MetricTile label="Save Rate" value={`${((data.rates?.saveRate ?? 0) * 100).toFixed(2)}%`} />
                            <MetricTile label="Products" value={data.totals?.products ?? 0} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {!loading && data && (
                <Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">Plan & Billing</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-purple-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span>Plan</span>
                            <span className="text-white font-medium uppercase">{data.vendor?.plan || 'BASIC'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Subscription Status</span>
                            <span className="text-white font-medium">{data.vendor?.subscriptionStatus || 'INACTIVE'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Current Period Ends</span>
                            <span className="text-white font-medium">{data.vendor?.currentPeriodEnd ? new Date(data.vendor.currentPeriodEnd).toLocaleDateString() : '—'}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && data && (
                <Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">Product Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.products?.length ? (
                            <Table className="text-purple-200 text-sm">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Impressions</TableHead>
                                        <TableHead>Clicks</TableHead>
                                        <TableHead>Saves</TableHead>
                                        <TableHead>CTR</TableHead>
                                        <TableHead>Save Rate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.products.map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {item.imageUrl ? (
                                                        <img src={item.imageUrl} alt={item.title} className="w-10 h-10 rounded object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-purple-500/30" />
                                                    )}
                                                    <div>
                                                        <div className="text-white font-medium line-clamp-1">{item.title}</div>
                                                        {item.price ? (
                                                            <div className="text-xs text-purple-300">{item.currency ?? 'USD'} {item.price.toFixed(2)}</div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{item.impressions}</TableCell>
                                            <TableCell>{item.clicks}</TableCell>
                                            <TableCell>{item.saves}</TableCell>
                                            <TableCell>{(item.ctr * 100).toFixed(1)}%</TableCell>
                                            <TableCell>{(item.saveRate * 100).toFixed(1)}%</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-purple-200">No product metrics yet.</div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
            <div className="text-xs uppercase tracking-wide text-purple-300">{label}</div>
            <div className="text-xl text-white font-semibold">{value}</div>
        </div>
    )
}

function InsightList({ title, items, emptyLabel }: { title: string; items?: Array<{ label: string; value: number }>; emptyLabel: string }) {
    return (
        <div>
            <div className="text-white font-semibold mb-2">{title}</div>
            {items && items.length ? (
                <div className="space-y-2">
                    {items.map((item) => (
                        <div key={`${title}-${item.label}`} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded border border-white/10 text-sm">
                            <span className="text-white">{item.label}</span>
                            <span className="text-purple-300">{item.value}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-purple-300 text-sm">{emptyLabel}</div>
            )}
        </div>
    )
}