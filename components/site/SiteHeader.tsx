"use client"

import Link from 'next/link'
import { Gift, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { trackEvent } from '@/lib/track'

export function SiteHeader() {
  const [user, setUser] = useState<any>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      setUser(res.data.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
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
        <Link href="/" aria-label="Home" className="flex items-center gap-3 transition-transform duration-200">
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
            <Gift className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-white">The Gift Aunty</span>
        </Link>

        <nav className="flex items-center gap-3 text-white">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10"
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

          {user ? (
            <Button asChild variant="ghost" className="text-white hover:bg-white/10">
              <Link href="/auth/sign-out" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Sign out
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" className="text-white hover:bg-white/10">
              <Link href="/auth/sign-in" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Sign in
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}