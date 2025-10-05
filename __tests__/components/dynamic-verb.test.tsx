import React from "react"
import { act, fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import DynamicVerb from "@/components/DynamicVerb"

describe("DynamicVerb", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }))
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("cycles verbs every 4 seconds when not paused", () => {
    const { container } = render(<DynamicVerb />)

    expect(container.querySelector('[data-current-verb="love"]')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(container.querySelector('[data-current-verb="adore"]')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(container.querySelector('[data-current-verb="treasure"]')).toBeInTheDocument()
  })

  it("pauses on hover and resumes after", () => {
    const { container } = render(<DynamicVerb />)
    const span = container.querySelector('[data-current-verb]') as HTMLElement

    act(() => {
      fireEvent.mouseEnter(span)
      vi.advanceTimersByTime(8000)
    })
    expect(container.querySelector('[data-current-verb="love"]')).toBeInTheDocument()

    act(() => {
      fireEvent.mouseLeave(span)
      vi.advanceTimersByTime(4000)
    })
    expect(container.querySelector('[data-current-verb="adore"]')).toBeInTheDocument()
  })

  it("does not cycle when prefers-reduced-motion is true", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any
    const { container } = render(<DynamicVerb />)

    expect(container.querySelector('[data-current-verb="love"]')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(16000)
    })
    expect(container.querySelector('[data-current-verb="love"]')).toBeInTheDocument()
  })
})

