'use client'

import { useEffect, useState, useRef } from 'react'
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
import Image from 'next/image'
import familyFriends from '@Images/FamilyFriends.png'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [showSwipeDeck, setShowSwipeDeck] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [sessionId, setSessionId] = useState<string>('')
  const [savedFormData, setSavedFormData] = useState<GiftFormData | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [bgProgress, setBgProgress] = useState(0)
  const [bgFocus, setBgFocus] = useState(0)
  const [bgColorScheme, setBgColorScheme] = useState<'default' | 'blue'>('default')
  const auraRef = useRef<HTMLDivElement | null>(null)

  // Restore user/session from URL or localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const u = params.get('u')
      const sid = params.get('sid') || params.get('session_id')
      const storedUser = window.localStorage.getItem('pg_userId') || undefined
      const nextUser = u || storedUser
      if (nextUser) setUserId(nextUser)
      if (nextUser && !storedUser) window.localStorage.setItem('pg_userId', nextUser)
      if (sid) setSessionId(sid)
    } catch (e) {
      // ignore
    }
  }, [])

  // Scroll-linked spotlight + background focus
  useEffect(() => {
    if (typeof window === 'undefined') return
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
    let ticking = false

    const update = () => {
      ticking = false
      const y = window.scrollY || 0
      const focus = clamp((y - 100) / 200, 0, 1)
      setBgFocus(focus)

      // Spotlight opacity for key sections
      const elements = document.querySelectorAll<HTMLElement>('[data-spotlight="true"]')
      const vpCenter = window.innerHeight / 2
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const dist = Math.abs(center - vpCenter)
        const ratio = clamp(dist / (window.innerHeight / 2), 0, 1)
        const opacity = 1 - 0.3 * ratio // min 0.7
        el.style.opacity = String(clamp(opacity, 0.7, 1))
      })

      // Apply same blur/brightness to aura
      const aura = auraRef.current
      if (aura) {
        const blurPx = 8 * focus
        const brightness = 1 - 0.3 * focus
        aura.style.filter = `blur(${blurPx}px) brightness(${brightness})`
      }
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update)
        ticking = true
      }
    }
    const onResize = onScroll

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const handleFormSubmit = async (formData: GiftFormData) => {
    setIsLoading(true)
    setSavedFormData(formData)
    setCurrentPage(0)
    
    // Generate a temporary user ID if not logged in
    const tempUserId = userId || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    if (!userId) {
      setUserId(tempUserId)
      try { window.localStorage.setItem('pg_userId', tempUserId) } catch {}
    }

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          userId: tempUserId,
          page: 0,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setRecommendations(data.recommendations || [])
        setSessionId(data.sessionId)
        setShowSwipeDeck(true)
         setHasMore(data.recommendations.length >= 30)
      } else {
        console.error('Failed to get recommendations')
        alert('Failed to get recommendations. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwipe = async (productId: string, action: 'LEFT' | 'RIGHT' | 'SAVED') => {
    try {
      const p = recommendations.find(p => p.id === productId)
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productId,
          action,
          sessionId,
          product: p ? {
            title: p.title,
            description: p.description,
            price: p.price,
            imageUrl: p.imageUrl,
            affiliateUrl: p.affiliateUrl,
            categories: p.categories,
          } : undefined,
        }),
      })

      if (!response.ok) {
        console.error('Failed to record swipe')
      }
      // Persist swipe locally for session recovery
      try {
        const key = `pg_swipes:${sessionId || 'default'}`
        const list = JSON.parse(window.localStorage.getItem(key) || '[]')
        list.push({ productId, action, ts: Date.now() })
        window.localStorage.setItem(key, JSON.stringify(list))
        if (action === 'SAVED') {
          window.dispatchEvent(new CustomEvent('pg:saved-updated'))
        }
      } catch {}
    } catch (error) {
      console.error('Error recording swipe:', error)
    }
  }

  const handleLoadMore = async () => {
    if (!savedFormData || !hasMore) return

    setIsLoading(true)
    const nextPage = currentPage + 1

    try {
      const response = await fetch('/api/recommend-more', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData: savedFormData,
          page: nextPage,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.recommendations && data.recommendations.length > 0) {
          setRecommendations((prev) => {
            const existingKeys = new Set(
              prev.map((p) => (p.affiliateUrl && p.affiliateUrl.length > 0 ? p.affiliateUrl : p.id || p.title))
            )
            const incoming = (data.recommendations as any[])
            const deduped = incoming.filter((p) => {
              const key = p.affiliateUrl && p.affiliateUrl.length > 0 ? p.affiliateUrl : p.id || p.title
              return key && !existingKeys.has(key)
            })
            return [...prev, ...deduped]
          })
          setCurrentPage(nextPage)
          setHasMore(Boolean(data.hasMore))
        } else {
          setHasMore(false)
        }
      }
    } catch (error) {
      console.error('Error loading more recommendations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartNew = () => {
    setShowSwipeDeck(false)
    setRecommendations([])
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10 bg-animated">
      <BubbleGraph progress={bgProgress} focus={bgFocus} colorScheme={bgColorScheme} />
      <Hero data-spotlight="true" />
      <div className="container mx-auto px-4 pb-10 md:pb-16 relative">

        {!showSwipeDeck ? (
          <div className="relative">
            {/* Aura behind the main form */}
            <div ref={auraRef} aria-hidden className="pointer-events-none absolute inset-0 z-0">
              <div className="absolute -top-24 -left-8 w-72 h-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.35),transparent_60%)] blur-[150px] opacity-20" />
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.35),transparent_60%)] blur-[150px] opacity-20" />
              <div className="absolute -bottom-20 -right-8 w-80 h-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.30),transparent_60%)] blur-[150px] opacity-20" />
            </div>
            <div id="gift-form" className="flex justify-center relative z-10" data-spotlight="true">
              <GiftForm 
                onSubmit={handleFormSubmit} 
                isLoading={isLoading} 
                onProgressChange={setBgProgress}
                // Respond to gender selection to toggle bubble color theme
                onGenderChange={(gender) => {
                  const g = (gender || '').toLowerCase()
                  if (g === 'male' || g === 'boy') setBgColorScheme('blue')
                  else setBgColorScheme('default')
                }}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <Button variant="outline" onClick={handleStartNew}>
                ← New Search
              </Button>
              <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>
      {!showSwipeDeck && <>
        <div className="mt-28 md:mt-32" data-spotlight="true">
          <FeatureGrid />
        </div>
        <div data-spotlight="true">
          <SwipeSection />
        </div>
        {/* Post-features CTA section */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20 shadow-lg" data-spotlight="true">
              <div className="flex-1 text-center md:text-left">
                <p className="text-xl md:text-2xl text-muted-foreground italic">
                  &quot;Spend more time with them — not searching for them.&quot;
                </p>
              </div>
              <div className="w-full md:w-64">
                <Image
                  src={familyFriends}
                  alt="Family and friends spending time together"
                  className="w-full h-36 md:h-40 object-cover rounded-xl"
                  priority
                  sizes="(min-width: 768px) 18rem, 100vw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Local SEO Section */}
        <section className="py-8 md:py-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Find Gifts Near You</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover unique local gift shops and boutiques in your area. Support local businesses while finding one-of-a-kind presents.
            </p>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/80 dark:bg-white/5 rounded-lg p-6 backdrop-blur-sm">
                <div className="text-3xl mb-4">🏪</div>
                <h3 className="font-semibold mb-2">Local Gift Shops</h3>
                <p className="text-sm text-muted-foreground">Find unique boutiques and specialty stores near you</p>
              </div>
              <div className="bg-white/80 dark:bg-white/5 rounded-lg p-6 backdrop-blur-sm">
                <div className="text-3xl mb-4">🎨</div>
                <h3 className="font-semibold mb-2">Artisan Markets</h3>
                <p className="text-sm text-muted-foreground">Handcrafted gifts from local makers and artists</p>
              </div>
              <div className="bg-white/80 dark:bg-white/5 rounded-lg p-6 backdrop-blur-sm">
                <div className="text-3xl mb-4">🛍️</div>
                <h3 className="font-semibold mb-2">Shopping Centers</h3>
                <p className="text-sm text-muted-foreground">Department stores and malls with gift sections</p>
              </div>
            </div>
            <div className="mt-8">
              <Link
                href="/local-gifts"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
              >
                Find Local Gift Shops →
              </Link>
            </div>
          </div>
        </section>
      </>}
    </main>
  )
} 