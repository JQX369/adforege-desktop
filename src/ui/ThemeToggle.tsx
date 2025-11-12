'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/src/ui/button'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    if (typeof document === 'undefined') return
    const current = (document.documentElement.dataset.theme as 'light' | 'dark') || 'light'
    setTheme(current)
  }, [])

  const toggle = () => {
    if (typeof document === 'undefined') return
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      window.localStorage.setItem('theme', next)
    } catch {}
    setTheme(next)
  }

  return (
    <Button
      variant="ghost"
      aria-label="Toggle theme"
      onClick={toggle}
      className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-white hover:bg-white/20"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}


