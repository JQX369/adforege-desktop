'use client'

import Link from 'next/link'
import { ReactNode, useMemo } from 'react'
import DynamicVerb from '@/components/DynamicVerb'

interface HeroProps {
  onStart?: () => void
  trustRow?: ReactNode
  heading?: string
  scheme?: 'default' | 'pink' | 'blue'
  formSlot?: ReactNode
}

export function Hero({
  onStart,
  trustRow,
  heading,
  scheme = 'default',
  formSlot,
}: HeroProps) {
  const schemeClass = useMemo(() => {
    switch (scheme) {
      case 'pink':
        return 'hero-scheme-pink'
      case 'blue':
        return 'hero-scheme-blue'
      default:
        return 'hero-scheme-default'
    }
  }, [scheme])

  const handleStart = () => {
    onStart?.()
  }

  const renderHeading = () => {
    if (heading) {
      return heading
    }
    return (
      <>
        Find gifts they&apos;ll <DynamicVerb />
      </>
    )
  }

  return (
    <section className={`hero-shell relative overflow-hidden ${schemeClass}`}>
      {/* Bubbles behind content */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 mix-blend-normal"
      >
        <div className="hero-bubble hero-bubble--primary" />
        <div className="hero-bubble hero-bubble--secondary" />
        <div className="hero-bubble hero-bubble--accent" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-10 pt-28 text-center">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <p className="text-body-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Completely free
          </p>
          <h1 className="text-balance text-display-xl text-foreground leading-tight">
            {renderHeading()}
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-body-lg text-muted-foreground leading-relaxed">
            Answer a few quick questions. We&apos;ll surface spot-on ideas with
            instant purchase links. No guesswork, just magic.
          </p>
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#quiz"
            onClick={handleStart}
            data-analytics="cta_primary_click"
            className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
          >
            Start AI gift quiz
          </a>
          <Link
            href="/gift-guides"
            data-analytics="guides_click"
            className="text-lg font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
          >
            Browse gift guides
          </Link>
        </div>
        {trustRow ? (
          <div className="mt-12 flex justify-center">{trustRow}</div>
        ) : null}

        {formSlot ? (
          <div className="mt-10 flex w-full justify-center">{formSlot}</div>
        ) : null}
      </div>
    </section>
  )
}
