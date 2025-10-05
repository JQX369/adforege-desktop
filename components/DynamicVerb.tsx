"use client"

import React, { useEffect, useRef, useState } from "react"

const VERBS = ["love", "adore", "treasure", "be thrilled by"] as const
const INTERVAL_MS = 4000

export default function DynamicVerb() {
  const [index, setIndex] = useState(0)
  const paused = useRef(false)
  const prefersReducedMotion = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    prefersReducedMotion.current = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion.current) return

    const id = window.setInterval(() => {
      if (!paused.current) {
        setIndex((prev) => (prev + 1) % VERBS.length)
      }
    }, INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [])

  return (
    <span
      className="transition-opacity duration-500"
      data-current-verb={VERBS[index]}
      onMouseEnter={() => {
        paused.current = true
      }}
      onMouseLeave={() => {
        paused.current = false
      }}
    >
      {VERBS[index]}
    </span>
  )
}

