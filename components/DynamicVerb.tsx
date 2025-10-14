"use client"

import React, { useEffect, useRef, useState } from "react"

const VERBS = ["love", "adore", "treasure", "be thrilled by", "cherish", "appreciate"] as const
const INTERVAL_MS = 3000

export default function DynamicVerb() {
  const [index, setIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [displayText, setDisplayText] = useState("")
  const paused = useRef(false)
  const prefersReducedMotion = useRef(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (typeof window === "undefined") return
    prefersReducedMotion.current = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches                                           
    if (prefersReducedMotion.current) {
      setDisplayText(VERBS[0])
      return
    }

    const typeText = (text: string) => {
      setIsTyping(true)
      setDisplayText("")
      let i = 0
      
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1))
          i++
        } else {
          clearInterval(typeInterval)
          setIsTyping(false)
          // Wait a bit before starting to delete
          typingTimeoutRef.current = setTimeout(() => {
            if (!paused.current) {
              deleteText(text)
            }
          }, 2000)
        }
      }, 100)
    }

    const deleteText = (text: string) => {
      let i = text.length
      
      const deleteInterval = setInterval(() => {
        if (i > 0) {
          setDisplayText(text.slice(0, i - 1))
          i--
        } else {
          clearInterval(deleteInterval)
          // Move to next word
          setIndex((prev) => (prev + 1) % VERBS.length)
        }
      }, 50)
    }

    const id = window.setInterval(() => {
      if (!paused.current && !isTyping) {
        typeText(VERBS[index])
      }
    }, INTERVAL_MS)

    return () => {
      window.clearInterval(id)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [index, isTyping])

  // Start typing when index changes
  useEffect(() => {
    if (prefersReducedMotion.current) return
    
    const typeText = (text: string) => {
      setIsTyping(true)
      setDisplayText("")
      let i = 0
      
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1))
          i++
        } else {
          clearInterval(typeInterval)
          setIsTyping(false)
        }
      }, 100)
    }

    typeText(VERBS[index])
  }, [index])

  return (
    <span
      className="transition-all duration-300 font-semibold text-primary"
      data-current-verb={VERBS[index]}
      onMouseEnter={() => {
        paused.current = true
      }}
      onMouseLeave={() => {
        paused.current = false
      }}
    >
      {displayText}
      {isTyping && <span className="animate-pulse">|</span>}
    </span>
  )
}

