import Link from 'next/link'
import { ReactNode, useMemo } from 'react'
import BubbleGraph from '@/components/visuals/BubbleGraph'
import { Features } from '@/components/Features'
import { GuidesCta } from '@/components/GuidesCta'
import { QuizIntro } from '@/components/QuizIntro'
import { SwipeDemo } from '@/components/SwipeDemo'
import { Testimonials } from '@/components/Testimonials'

export type LandingBubbleScheme = 'default' | 'pink' | 'blue'

interface LandingSimpleProps {
  onStartQuiz: (source: 'hero' | 'quiz_intro' | 'swipe_demo') => void
  formSlot?: ReactNode
  swipeDeckSection?: ReactNode
  showSwipeDeck: boolean
  bubbleScheme?: LandingBubbleScheme
  trustRow?: ReactNode
  heading?: string
  subheading?: string
  fallbackTrustRow?: ReactNode
}

const heroHighlights = [
  { icon: '🎯', label: 'Personalized AI matches' },
  { icon: '🛒', label: 'Instant shopping links' },
  { icon: '💌', label: 'Save & share favourites' },
]

export function LandingSimple({
  onStartQuiz,
  formSlot,
  swipeDeckSection,
  showSwipeDeck,
  bubbleScheme = 'default',
  trustRow,
  heading = 'Perfect gifts. Zero guesswork.',
  subheading = "Tell us who you're shopping for and our friendly AI will surface thoughtful, shoppable gift ideas in minutes.",
  fallbackTrustRow,
}: LandingSimpleProps) {
  const gradientClass = useMemo(() => {
    switch (bubbleScheme) {
      case 'blue':
        return 'from-sky-500 to-indigo-600'
      case 'pink':
        return 'from-rose-500 via-fuchsia-500 to-violet-500'
      default:
        return 'from-amber-500 via-rose-500 to-violet-500'
    }
  }, [bubbleScheme])

  const bubbleColorScheme = bubbleScheme === 'blue' ? 'blue' : 'default'
  const bubbleProgress = showSwipeDeck ? 0.85 : formSlot ? 0.55 : 0.35

  return (
    <div className="relative isolate overflow-hidden">
      <BubbleGraph
        progress={bubbleProgress}
        colorScheme={bubbleColorScheme}
        focus={showSwipeDeck ? 0.25 : 0.1}
      />

      <main className="relative z-10 flex flex-col gap-20 pb-24">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-24 text-center sm:pt-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Completely free
            </span>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {heading}
            </h1>
            <p className="text-balance text-base text-muted-foreground sm:text-lg lg:text-xl">
              {subheading}
            </p>
            <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                data-analytics="cta_primary_click"
                onClick={() => onStartQuiz('hero')}
                className={`inline-flex min-w-[220px] items-center justify-center rounded-full bg-gradient-to-r ${gradientClass} px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:shadow-xl focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30`}
              >
                Start gift quiz
              </button>
              <Link
                href="/gift-guides"
                data-analytics="guides_click"
                className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-border/70 bg-background/80 px-8 py-4 text-lg font-semibold text-foreground shadow-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/20"
              >
                Browse gift guides
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:text-base">
              {heroHighlights.map(({ icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <span aria-hidden>{icon}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {trustRow ? (
            <div className="mt-10 flex justify-center">{trustRow}</div>
          ) : null}
        </section>

        {!trustRow && fallbackTrustRow ? (
          <div className="mx-auto max-w-4xl px-6">{fallbackTrustRow}</div>
        ) : null}

        {showSwipeDeck && swipeDeckSection ? (
          <section aria-label="Your gift matches" className="bg-background/70 py-12">
            {swipeDeckSection}
          </section>
        ) : null}

        {formSlot ? (
          <div className="flex flex-col gap-12">
            <QuizIntro onStart={() => onStartQuiz('quiz_intro')} />
            <section className="mx-auto w-full max-w-4xl px-6" id="quiz">
              {formSlot}
            </section>
          </div>
        ) : null}

        <Features />

        <Testimonials />

        {!showSwipeDeck ? <SwipeDemo onCta={() => onStartQuiz('swipe_demo')} /> : null}

        <GuidesCta />
      </main>
    </div>
  )
}
