"use client"

import Link from 'next/link'
import { Gift, User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export function SiteHeader() {
  const [user, setUser] = useState<any>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      setUser(res.data.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      <div className="site-header-inner container mx-auto px-4 flex items-center justify-between">
        <Link href="/" aria-label="Home" className="flex items-center gap-3 group hover:scale-105 transition-transform duration-200">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
            <Gift className="w-5 h-5 text-white" />
          </span>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            The Gift Aunty
          </span>
        </Link>
        
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost" className="text-white nav-link-glow hover:bg-white/10 hover:text-purple-200 transition-all duration-200">
            <Link href="/vendor">✨ For Vendors</Link>
          </Button>
          
          {user ? (
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" className="text-white nav-link-glow hover:bg-white/10 hover:text-purple-200 transition-all duration-200">
                <Link href="/vendor/dashboard" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
              <Button 
                onClick={signOut}
                variant="ghost" 
                className="text-white nav-link-glow hover:bg-white/10 hover:text-purple-200 transition-all duration-200 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
            </div>
          ) : (
            <Button asChild variant="ghost" className="text-white nav-link-glow hover:bg-white/10 hover:text-purple-200 transition-all duration-200">
              <Link href="/auth/sign-in" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Sign in
              </Link>
            </Button>
          )}
          
          <Button asChild className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 cta-glow">
            <Link href="/#gift-form">🎁 Find Gifts</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}