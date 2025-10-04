"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { GiftForm } from '@/components/GiftForm'
import { SwipeDeck, Product } from '@/components/SwipeDeck'
import { SavedDrawer } from '@/components/SavedDrawer'
import { GiftFormData } from '@/prompts/GiftPrompt'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/site/Hero'
import { FeatureGrid } from '@/components/site/FeatureGrid'
import { SwipeSection } from '@/components/site/SwipeSection'
import BubbleGraph from '@/components/visuals/BubbleGraph'
import { trackEvent } from '@/lib/track'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [showSwipeDeck, setShowSwipeDeck] = useState(false)
  const [userId, setUserId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [savedFormData, setSavedFormData] = useState<GiftFormData | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [bubbleProgress, setBubbleProgress] = useState(0.2)
  const [bubbleFocus, setBubbleFocus] = useState(0)
  const [bubbleScheme, setBubbleScheme] = useState<'default' | 'blue'>('default')
  const spotlightRefs = useRef<HTMLElement[]>([])

  // Restore user/session from URL or local storage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const idFromQuery = params.get('u') || undefined
    const storedId = window.localStorage.getItem('pg_userId') || undefined
    const nextId = idFromQuery || storedId
    if (nextId) {
      setUserId(nextId)
      if (!storedId) window.localStorage.setItem('pg_userId', nextId)
    }
    const sid = params.get('sid') || params.get('session_id') || ''
    if (sid) setSessionId(sid)
  }, [])

  // Spotlight scroll effect applied to key sections
  useEffect(() => {
    if (typeof window === 'undefined') return
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-spotlight="true"]'))
    spotlightRefs.current = elements
    const onScroll = () => {
      const mid = window.innerHeight / 2
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const distRatio = Math.min(1, Math.abs(center - mid) / mid)
        el.style.opacity = String(1 - distRatio * 0.25)
      })
      const y = window.scrollY || 0
      setBubbleFocus(Math.min(1, Math.max(0, (y - 100) / 250)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const ensureUserId = () => {
    if (userId) return userId
    const generated = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setUserId(generated)
    try {
      window.localStorage.setItem('pg_userId', generated)
    } catch {}
    return generated
  }

  const handleFormSubmit = async (formData: GiftFormData) => {
    const activeUserId = ensureUserId()
    setIsLoading(true)
    setSavedFormData(formData)
    setCurrentPage(0)
    trackEvent('form_submitted', { step: 'complete' })
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData, userId: activeUserId, page: 0 }),
      })
      if (!res.ok) throw new Error('Recommendation request failed')
      const data = await res.json()
      setRecommendations(data.recommendations || [])
      setSessionId(data.sessionId || '')
      setHasMore(Boolean(data.hasMore ?? (data.recommendations || []).length >= 30))
      setShowSwipeDeck(true)
    } catch (error) {
      console.error(error)
      alert('We couldn\'t generate recommendations right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwipe = async (productId: string, action: 'LEFT' | 'RIGHT' | 'SAVED') => {
    try {
      const product = recommendations.find((p) => p.id === productId)
      await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          productId,
          action,
          sessionId,
          product: product
            ? {
                title: product.title,
                description: product.description,
                price: product.price,
                imageUrl: product.imageUrl,
                affiliateUrl: product.affiliateUrl,
                categories: product.categories,
              }
            : undefined,
        }),
      })
      if (action === 'RIGHT') {
        window.dispatchEvent(new CustomEvent('pg:saved-updated'))
      }
    } catch (error) {
      console.error('Error logging swipe', error)
    }
  }

  const handleLoadMore = async () => {
    if (!savedFormData || !hasMore) return
    const nextPage = currentPage + 1
    setIsLoading(true)
    try {
      const res = await fetch('/api/recommend-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: savedFormData, page: nextPage }),
      })
      if (!res.ok) throw new Error('Load more failed')
      const data = await res.json()
      const incoming: Product[] = data.recommendations || []
      if (!incoming.length) {
        setHasMore(false)
      } else {
        setRecommendations((prev) => {
          const existingKeys = new Set(
            prev.map((p) => (p.affiliateUrl?.length ? p.affiliateUrl : p.id || p.title))
          )
          const deduped = incoming.filter((p) => {
            const key = p.affiliateUrl?.length ? p.affiliateUrl : p.id || p.title
            return key && !existingKeys.has(key)
          })
          return [...prev, ...deduped]
        })
        setHasMore(Boolean(data.hasMore ?? incoming.length >= 30))
        setCurrentPage(nextPage)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartNew = () => {
    setShowSwipeDeck(false)
    setRecommendations([])
    setSavedFormData(null)
    setCurrentPage(0)
    setHasMore(true)
    if (typeof window !== 'undefined') {
      const el = document.getElementById('gift-form')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const testimony = useMemo(
    () => [
      { quote: '“Matched my partner with the perfect surprise within five minutes.”', author: 'Amelia · London' },
      { quote: '“A lifesaver for last-minute gifting. I saved three ideas instantly.”', author: 'Jordan · New York' },
      { quote: '“Feels like a personal shopper who actually knows my friends.”', author: 'Priya · Dublin' },
    ],
    []
  )

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <BubbleGraph progress={bubbleProgress} focus={bubbleFocus} colorScheme={bubbleScheme} />
      <Hero
        data-spotlight="true"
        onStart={() => {
          const el = document.getElementById('gift-form')
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      <div className="container mx-auto px-4 pb-14 md:pb-20 relative" data-spotlight="true">
        {!showSwipeDeck ? (
          <div id="gift-form" className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl border border-white/40 bg-white/70 backdrop-blur shadow-xl dark:bg-slate-950/60 dark:border-white/10 p-1 md:p-2">
              <div className="rounded-[calc(theme(radius.3xl)-4px)] bg-gradient-to-br from-purple-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 md:p-10">
                <div className="flex flex-col md:flex-row gap-8 mb-10">
                  <div className="md:w-1/2 space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-500">
                      Just 2 minutes
                    </p>
                    <h2 className="text-2xl md:text-3xl font-bold text-balance">
                      Tell us about them and we&apos;ll surface shoppable gifts matched to their personality.
                    </h2>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• 12 smart questions tuned for occasion, budget, interests</li>
                      <li>• Instantly see ideas with direct purchase links</li>
                      <li>• Save favourites and share with friends</li>
                    </ul>
                  </div>
                  <div className="md:w-1/2">
                    <GiftForm
                      onSubmit={handleFormSubmit}
                      isLoading={isLoading}
                      onProgressChange={setBubbleProgress}
                      onGenderChange={(gender) => {
                        const g = (gender || '').toLowerCase()
                        setBubbleScheme(g === 'male' ? 'blue' : 'default')
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {['/avatars/1.png', '/avatars/2.png', '/avatars/3.png'].map((src, idx) => (
                        <span
                          key={idx}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs shadow"
                        >
                          {idx + 1}
                        </span>
                      ))}
                    </div>
                    <span>Trusted by 8,400+ gifters in the past 90 days</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                    <span>🔒 No login required</span>
                    <span>•</span>
                    <span>As an Amazon Associate we earn from qualifying purchases</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto" data-spotlight="true">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              <div className="text-left">
                <h2 className="text-2xl font-semibold">Your matches</h2>
                <p className="text-sm text-muted-foreground">Swipe right to save, left to pass. We&apos;ll keep refining.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={handleStartNew}>
                  ← Start over
                </Button>
                <SavedDrawer userId={userId} />
              </div>
            </div>

            <SwipeDeck
              products={recommendations}
              onSwipe={handleSwipe}
              userId={userId}
              sessionId={sessionId}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
            />

            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground">
                Want more ideas?{' '}
                <button className="underline underline-offset-4" onClick={handleLoadMore} disabled={!hasMore || isLoading}>
                  {hasMore ? 'Load another batch' : 'You reached the end of this list'}
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      {!showSwipeDeck && (
        <>
          <section className="py-12 md:py-16" data-spotlight="true">
            <div className="container mx-auto px-4">
              <FeatureGrid />
            </div>
          </section>

          <section className="py-12 md:py-16 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" data-spotlight="true">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8">Loved by gifters everywhere</h2>
              <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
                {testimony.map((t) => (
                  <blockquote key={t.author} className="rounded-xl bg-white/80 dark:bg-white/5 p-5 shadow-sm border border-white/40">
                    <p className="italic mb-3">{t.quote}</p>
                    <footer className="text-xs font-semibold text-primary">{t.author}</footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>

          <section className="py-12 md:py-16" data-spotlight="true">
            <div className="container mx-auto px-4">
              <SwipeSection />
            </div>
          </section>

          <section className="py-12 md:py-16" data-spotlight="true">
            <div className="container mx-auto px-4">
              <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 md:p-10 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-semibold mb-2">Explore gift guides curated by our team</h2>
                  <p className="text-sm text-purple-100 max-w-xl">
                    Need inspiration by occasion or price point? Browse our evergreen guides packed with AI-vetted ideas for every type of recipient.
                  </p>
                </div>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/gift-guides">View gift guides →</Link>
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  )
}