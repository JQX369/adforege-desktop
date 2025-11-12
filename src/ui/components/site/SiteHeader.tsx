'use client'

import Link from 'next/link'
import { Gift } from 'lucide-react'
import { Button } from '@/src/ui/button'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { trackEvent } from '@/lib/track'
import { ThemeToggle } from '@/src/ui/ThemeToggle'

export function SiteHeader() {
  const [user, setUser] = useState<any>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      setUser(res.data.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const header = document.querySelector('header.site-header')
    if (!header) return
    const onScroll = () => {
      const y = window.scrollY || 0
      if (y > 50) header.classList.add('is-scrolled')
      else header.classList.remove('is-scrolled')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="site-header">
      <div className="site-header-inner container mx-auto flex items-center justify-between px-6">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center gap-3 transition-transform duration-200"
        >
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
            <Gift className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-white">
            FairyWize
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3 text-white">
          <Link
            href="/gift-guides"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-white/40 md:inline-flex"
            data-analytics="guides_header_link"
          >
            Gift guides
          </Link>
          <Link
            href="/vendor"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-white/40 md:inline-flex"
            data-analytics="vendor_header_link"
          >
            For vendors
          </Link>
          <ThemeToggle />
          <Button
            variant="ghost"
            className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-white/40"
            data-analytics="cta_header_start"
            onClick={() => {
              trackEvent('cta_primary_click', { source: 'header' })
              const el = document.getElementById('quiz')
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            Start gift quiz
          </Button>
        </nav>
      </div>
    </header>
  )
}
