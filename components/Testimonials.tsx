"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

type Testimonial = {
  quote: string
  author: string
  highlight: string
}

const testimonials: Testimonial[] = [
  {
    quote: "Matched my partner with the perfect surprise in minutes.",
    author: "Amelia · London",
    highlight: "perfect surprise",
  },
  {
    quote: "Saved three ideas instantly for my picky dad.",
    author: "Jordan · New York",
    highlight: "three ideas instantly",
  },
  {
    quote: "Feels like a personal shopper who knows my friends.",
    author: "Priya · Dublin",
    highlight: "personal shopper",
  },
]

export function Testimonials() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isScrollable, setIsScrollable] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setIsScrollable(el.scrollWidth > el.clientWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scrollBy = (direction: number) => {
    const el = containerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" })
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="testimonials-heading">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-3 text-left md:text-center md:items-center">
          <h2 id="testimonials-heading" className="text-display-sm text-foreground">
            Loved by gifters everywhere
          </h2>
          <p className="max-w-2xl text-body-base text-muted-foreground md:text-center">
            Real shoppers using our quiz to deliver thoughtful surprises right on time.
          </p>
        </div>

        <div className="relative">
          <div
            ref={containerRef}
            className="flex snap-x gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0"
            aria-label="Testimonials"
          >
            {testimonials.map(({ quote, author, highlight }) => (
              <figure
                key={author}
                className="snap-start rounded-2xl border border-border bg-card p-6 shadow-sm md:snap-none"
              >
                <blockquote className="text-body-base text-muted-foreground">
                  {highlight
                    ? quote.split(new RegExp(`(${highlight})`, "i")).map((segment, idx) =>
                        segment.toLowerCase() === highlight.toLowerCase() ? (
                          <strong key={idx} className="text-foreground">
                            {segment}
                          </strong>
                        ) : (
                          <span key={idx}>{segment}</span>
                        )
                      )
                    : quote}
                </blockquote>
                <figcaption className="mt-4 text-body-sm font-semibold text-foreground">{author}</figcaption>
              </figure>
            ))}
          </div>

          {isScrollable && (
            <div className="pointer-events-none absolute inset-y-0 flex w-full items-center justify-between">
              <button
                type="button"
                aria-label="Scroll testimonials left"
                onClick={() => scrollBy(-1)}
                className="pointer-events-auto hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:bg-muted md:flex"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Scroll testimonials right"
                onClick={() => scrollBy(1)}
                className="pointer-events-auto h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:bg-muted"
              >
                →
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/reviews"
            className="text-body-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
            data-analytics="social_proof_more"
          >
            See more reviews
          </Link>
        </div>
      </div>
    </section>
  )
}

