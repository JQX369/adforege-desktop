'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, PanInfo } from 'framer-motion'
import { Button } from '@/src/ui/button'

type QuizAnswers = {
  relationship: string
  occasion: string
  interests: string[]
  vibe: string
}

const INITIAL_ANSWERS: QuizAnswers = {
  relationship: '',
  occasion: '',
  interests: [],
  vibe: '',
}

const RELATIONSHIP_OPTS = ['Partner', 'Parent', 'Sibling', 'Friend', 'Colleague', 'Other']
const OCCASION_OPTS = ['Birthday', 'Holiday', 'Anniversary', 'Housewarming', 'Just Because']
const INTEREST_OPTS = [
  'Cooking',
  'Tech',
  'Wellness',
  'Travel',
  'Art/Design',
  'Reading',
  'Fitness',
  'Music',
]
const VIBE_OPTS = ['Under $50, Fun', '$50-$100, Thoughtful', '$100+, Impressive', 'Money is no object']

export function Quiz() {
  const [step, setStep] = useState(1)
  const totalSteps = 4
  const [answers, setAnswers] = useState<QuizAnswers>(INITIAL_ANSWERS)

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('quizAnswers')
      if (saved) setAnswers(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem('quizAnswers', JSON.stringify(answers))
    } catch {}
  }, [answers])

  const progress = useMemo(() => Math.round((step / totalSteps) * 100), [step])

  function nextOrFinish(next: Partial<QuizAnswers>) {
    const updated = { ...answers, ...next }
    setAnswers(updated)
    if (step < totalSteps) {
      setStep((s) => s + 1)
    } else {
      // Navigate to discover; API will personalize server-side using session if available
      window.location.href = '/discover'
    }
  }

  function handleMultiSelect(value: string) {
    setAnswers((prev) => {
      const exists = prev.interests.includes(value)
      return {
        ...prev,
        interests: exists
          ? prev.interests.filter((v) => v !== value)
          : [...prev.interests, value],
      }
    })
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          role="progressbar"
        />
      </div>

      <Button
        type="button"
        onClick={() => (step === 1 ? (window.location.href = '/') : setStep((s) => s - 1))}
        className="mb-6"
        variant="ghost"
        aria-label="Go back"
      >
        ← Back
      </Button>

      <div className="min-h-[320px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <Step key="s1" title="Who is this lucky person to you?">
              {RELATIONSHIP_OPTS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={answers.relationship === opt}
                  onClick={() => nextOrFinish({ relationship: opt })}
                >
                  {opt}
                </OptionButton>
              ))}
            </Step>
          )}

          {step === 2 && (
            <Step key="s2" title="What's the special occasion?">
              {OCCASION_OPTS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={answers.occasion === opt}
                  onClick={() => nextOrFinish({ occasion: opt })}
                >
                  {opt}
                </OptionButton>
              ))}
            </Step>
          )}

          {step === 3 && (
            <Step
              key="s3"
              title="What are they into?"
              subtitle="Pick a few for better results."
            >
              <div className="grid grid-cols-2 gap-3">
                {INTEREST_OPTS.map((opt) => (
                  <OptionButton
                    key={opt}
                    multi
                    selected={answers.interests.includes(opt)}
                    onClick={() => handleMultiSelect(opt)}
                    aria-pressed={answers.interests.includes(opt)}
                  >
                    {opt}
                  </OptionButton>
                ))}
              </div>
              <Button
                type="button"
                className="mt-6 w-full"
                onClick={() => setStep(4)}
                disabled={answers.interests.length === 0}
              >
                Continue
              </Button>
            </Step>
          )}

          {step === 4 && (
            <Step key="s4" title="What's the vibe & budget?">
              {VIBE_OPTS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={answers.vibe === opt}
                  onClick={() => nextOrFinish({ vibe: opt })}
                >
                  {opt}
                </OptionButton>
              ))}
            </Step>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      <h2 className="mb-2 text-2xl font-bold text-foreground">{title}</h2>
      {subtitle && <p className="mb-6 text-muted-foreground">{subtitle}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </motion.div>
  )
}

function OptionButton({
  children,
  selected,
  onClick,
  multi = false,
  ...rest
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  multi?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border-2 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-sm'
          : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
      ].join(' ')}
      {...rest}
    >
      <div className="flex items-center justify-between">
        {children}
        {selected && multi && <span className="ml-3 inline-block h-3 w-3 rounded-full bg-amber-500" />}
      </div>
    </button>
  )
}


