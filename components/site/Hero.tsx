"use client"

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'

export function Hero(props: React.HTMLAttributes<HTMLElement>) {
  const words = useMemo(() => ['Love', 'Treasure', 'Cherish', 'Remember', 'Adore', 'Celebrate'], [])
  const [wordIndex, setWordIndex] = useState(0)
  const [display, setDisplay] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [pause, setPause] = useState(false)

  useEffect(() => {
    const current = words[wordIndex]
    const speed = deleting ? 110 : 180 // slowed down typing & deleting
    const endHold = 1000
    const startHold = 600

    if (pause) {
      const t = setTimeout(() => setPause(false), deleting ? startHold : endHold)
      return () => clearTimeout(t)
    }

    const timeout = setTimeout(() => {
      if (!deleting) {
        const next = current.slice(0, display.length + 1)
        setDisplay(next)
        if (next === current) {
          setPause(true)
          setDeleting(true)
        }
      } else {
        const next = current.slice(0, Math.max(display.length - 1, 0))
        setDisplay(next)
        if (next.length === 0) {
          setDeleting(false)
          setWordIndex((i) => (i + 1) % words.length)
          setPause(true)
        }
      }
    }, speed)
    return () => clearTimeout(timeout)
  }, [display, deleting, wordIndex, words, pause])

  return (
    <section className="relative overflow-hidden" {...props}>
      <div className="container mx-auto px-4 pt-10 pb-6 md:pt-16 md:pb-10 text-center">
        <Badge className="mb-4" variant="secondary">✨ Completely free AI gift finder</Badge>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4">
          <span className="block">Find gifts they'll actually{' '}</span>
          <span className="bg-[linear-gradient(90deg,hsl(var(--brand-1)),hsl(var(--brand-2)),hsl(var(--brand-3)))] bg-clip-text text-transparent">
            {display}
            <span className="inline-block w-[1ch] border-r-2 border-violet-600 animate-pulse ml-0.5" aria-hidden />
          </span>
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-6">
          Answer a few fun questions and let our AI curate perfect, personalized gift recommendations with direct shopping links.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>🎯 Personalized AI recommendations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>🛒 Direct affiliate shopping links</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <span>💝 Vendor marketplace included</span>
          </div>
        </div>
      </div>
      {/* Arc background behind the title */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_0%,rgba(255,99,132,0.10),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_480px_at_50%_10%,rgba(168,85,247,0.09),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1000px_520px_at_50%_20%,rgba(251,191,36,0.10),transparent_70%)] blur-2xl" />
      </div>
    </section>
  )
}

