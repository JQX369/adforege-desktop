'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface VendorStats {
	products: { id: string; title: string; savesCount: number }[]
	totals: { products: number; saves: number }
	vendor?: { subscriptionStatus: string; currentPeriodEnd?: string | null }
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
										<div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
											<span className="text-white font-medium">{p.title}</span>
											<span className="text-purple-300 text-sm bg-purple-500/20 px-2 py-1 rounded-full">
												❤️ {p.savesCount} saves
											</span>
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