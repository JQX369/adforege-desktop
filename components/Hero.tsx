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
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-24 text-center">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <p className="text-body-sm font-semibold uppercase tracking-[0.2em] text-primary">Personalised gifting in minutes</p>
          <h1 className="text-balance text-display-lg text-foreground">{title}</h1>
          <p className="mx-auto max-w-xl text-balance text-body-lg text-muted-foreground">
            Answer a few quick questions. We’ll surface spot-on ideas with instant purchase links.
          </p>
          <p className="text-body-sm text-muted-foreground">Real picks they’ll <DynamicVerb />.</p>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#quiz"
            onClick={handleStart}
            data-analytics="cta_primary_click"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
          >
            Start gift quiz
          </a>
          <Link
            href="#guides"
            data-analytics="guides_click"
            className="text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
          >
            Browse gift guides
          </Link>
        </div>
        {trustRow ? <div className="mt-10 flex justify-center">{trustRow}</div> : null}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_520px_at_50%_-120px,rgba(107,92,255,0.16),transparent_70%)]" />
    </section>
  )
}

