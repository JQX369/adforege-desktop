'use client'

import { useEffect, useRef, useState } from 'react'
import { GiftForm } from '@/components/GiftForm'
import { SwipeDeck, Product } from '@/components/SwipeDeck'
import { SavedDrawer } from '@/components/SavedDrawer'
import { GiftFormData } from '@/prompts/GiftPrompt'
import { Button } from '@/src/ui/button'
import { Hero } from '@/components/Hero'
import { TrustRow } from '@/components/TrustRow'
import { trackEvent } from '@/lib/track'

export default function HomePageClient() {
  const [isLoading, setIsLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [showSwipeDeck, setShowSwipeDeck] = useState(false)
  const [userId, setUserId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [savedFormData, setSavedFormData] = useState<GiftFormData | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [bubbleScheme, setBubbleScheme] = useState<'default' | 'pink' | 'blue'>(
    'default'
  )
  const variantLogged = useRef(false)
  const [trustTop, setTrustTop] = useState(false)
  const [headingVariant, setHeadingVariant] = useState<string | undefined>(
    undefined
  )

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
      setHasMore(
        Boolean(data.hasMore ?? (data.recommendations || []).length >= 30)
      )
      setShowSwipeDeck(true)
    } catch (error) {
      console.error(error)
      alert("We couldn't generate recommendations right now. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwipe = async (
    productId: string,
    action: 'LEFT' | 'RIGHT' | 'SAVED'
  ) => {
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
            prev.map((p) =>
              p.affiliateUrl?.length ? p.affiliateUrl : p.id || p.title
            )
          )
          const deduped = incoming.filter((p) => {
            const key = p.affiliateUrl?.length
              ? p.affiliateUrl
              : p.id || p.title
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
    setBubbleScheme('default')
    if (typeof window !== 'undefined') {
      const el = document.getElementById('quiz')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const variant = params.get('v')
    if (variant === 'trust-top') {
      setTrustTop(true)
    }
    if (variant === 'short') {
      setHeadingVariant('Perfect gifts, fast.')
    }
    if (variant && !variantLogged.current) {
      variantLogged.current = true
      trackEvent('page_variant', { variant })
    }
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <Hero
        onStart={() => {
          const el = document.getElementById('quiz')
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
        heading={headingVariant}
        trustRow={trustTop ? <TrustRow /> : undefined}
        scheme={bubbleScheme}
        formSlot={
          !showSwipeDeck ? (
            <div id="quiz" className="w-full max-w-2xl">
              <GiftForm
                onSubmit={handleFormSubmit}
                isLoading={isLoading}
                colorScheme={bubbleScheme}
                onGenderChange={(gender) => {
                  const g = (gender || '').toLowerCase()
                  if (g === 'male') setBubbleScheme('blue')
                  else if (g === 'female') setBubbleScheme('pink')
                  else setBubbleScheme('default')
                }}
              />
            </div>
          ) : undefined
        }
      />

      {!trustTop && !showSwipeDeck && (
        <TrustRow className="mx-auto max-w-4xl px-6" />
      )}

      {showSwipeDeck && (
        <section className="container mx-auto px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              <div className="text-left">
                <h2 className="text-display-xs text-foreground">
                  Your matches
                </h2>
                <p className="text-body-sm text-muted-foreground">
                  Swipe right to save, left to pass. We&apos;ll keep refining.
                </p>
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
              <p className="text-body-sm text-muted-foreground">
                Want more ideas?{' '}
                <button
                  className="underline underline-offset-4"
                  onClick={handleLoadMore}
                  disabled={!hasMore || isLoading}
                >
                  {hasMore
                    ? 'Load another batch'
                    : 'You reached the end of this list'}
                </button>
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
