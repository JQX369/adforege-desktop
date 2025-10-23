'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

const VERBS = [
  'love',
  'adore',
  'treasure',
  'cherish',
  'celebrate',
  'appreciate',
] as const

type Verb = (typeof VERBS)[number]

type TimerId = ReturnType<typeof setTimeout>
type IntervalId = ReturnType<typeof setInterval>

const TYPE_DELAY = 90
const DELETE_DELAY = 45
const HOLD_DELAY = 1600
const CYCLE_INTERVAL = 4000

export default function DynamicVerb() {
  const [index, setIndex] = useState(0)
  const [displayText, setDisplayText] = useState<Verb | string>(VERBS[0])
  const [cursorVisible, setCursorVisible] = useState(true)
  const paused = useRef(false)
  const prefersReducedMotion = useRef(false)
  const typingTimeoutRef = useRef<TimerId | null>(null)
  const intervalRef = useRef<IntervalId | null>(null)
  const cycleRef = useRef<IntervalId | null>(null)

  const currentWord: Verb = useMemo(() => VERBS[index], [index])

  useEffect(() => {
    if (typeof window === 'undefined') return
    prefersReducedMotion.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (prefersReducedMotion.current) {
      setDisplayText(currentWord)
      return
    }

    const runTypingCycle = async () => {
      const word = currentWord
      await typeText(word)
      if (paused.current) return
      await hold(word)
      if (paused.current) return
      await deleteText(word)
      if (paused.current) return
      setIndex((prev) => (prev + 1) % VERBS.length)
    }

    runTypingCycle()

    return () => {
      clearTimers()
    }
  }, [currentWord])

  useEffect(() => {
    if (prefersReducedMotion.current) return
    // Safety cycle tick to advance word every CYCLE_INTERVAL
    cycleRef.current = setInterval(() => {
      if (!paused.current) {
        setIndex((prev) => (prev + 1) % VERBS.length)
      }
    }, CYCLE_INTERVAL)
    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current)
    }
  }, [])

  const clearTimers = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const typeText = (text: string) => {
    setDisplayText('')
    return new Promise<void>((resolve) => {
      let i = 0
      intervalRef.current = setInterval(() => {
        setDisplayText(text.slice(0, i + 1))
        i += 1
        if (i === text.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          typingTimeoutRef.current = setTimeout(resolve, HOLD_DELAY)
        }
      }, TYPE_DELAY)
    })
  }

  const hold = (_text: string) =>
    new Promise<void>((resolve) => {
      typingTimeoutRef.current = setTimeout(resolve, HOLD_DELAY)
    })

  const deleteText = (text: string) =>
    new Promise<void>((resolve) => {
      let i = text.length
      intervalRef.current = setInterval(() => {
        i -= 1
        setDisplayText(text.slice(0, Math.max(0, i)))
        if (i <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          typingTimeoutRef.current = setTimeout(resolve, TYPE_DELAY)
        }
      }, DELETE_DELAY)
    })

  useEffect(() => {
    if (prefersReducedMotion.current) return
    const blink = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 450)
    return () => {
      clearInterval(blink)
    }
  }, [])

  return (
    <span
      className="inline-flex items-center font-semibold text-primary"
      data-current-verb={currentWord}
      onMouseEnter={() => {
        paused.current = true
      }}
      onMouseLeave={() => {
        paused.current = false
        setIndex((prev) => (prev + 1) % VERBS.length)
      }}
    >
      <span>{displayText}</span>
      {!prefersReducedMotion.current && (
        <span
          className={`ml-1 h-6 w-px bg-primary transition-opacity ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden
        />
      )}
    </span>
  )
}
