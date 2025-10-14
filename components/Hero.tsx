"use client"

import Link from "next/link"
import { ReactNode } from "react"
import DynamicVerb from "@/components/DynamicVerb"

interface HeroProps {
  onStart?: () => void
  trustRow?: ReactNode
  heading?: string
}

export function Hero({ onStart, trustRow, heading }: HeroProps) {
  const title = heading ?? "Find a gift they’ll love."

  const handleStart = () => {
    onStart?.()
  }

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <p className="text-body-sm font-semibold uppercase tracking-[0.2em] text-primary">AI-Powered Gift Discovery</p>
          <h1 className="text-balance text-display-xl text-foreground leading-tight">
            Find gifts they'll <DynamicVerb />
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-body-lg text-muted-foreground leading-relaxed">
            Our AI learns their preferences and surfaces perfect gifts in seconds. 
            No more guessing games or endless scrolling.
          </p>
        </div>
        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#quiz"
            onClick={handleStart}
            data-analytics="cta_primary_click"
            className="inline-flex min-w-[240px] items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:shadow-xl hover:scale-105 focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
          >
            Start AI Gift Quiz
          </a>
          <Link
            href="#guides"
            data-analytics="guides_click"
            className="text-lg font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
          >
            Browse Gift Guides
          </Link>
        </div>
        {trustRow ? <div className="mt-16 flex justify-center">{trustRow}</div> : null}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(107,92,255,0.12),transparent_70%)]" />
    </section>
  )
}

