"use client"

import React, { useEffect, useRef } from 'react'

interface BubbleGraphProps {
  progress: number // 0..1
}

interface NodePoint {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  scale: number
}

// Lightweight interactive bubble/connection background
export function BubbleGraph({ progress, focus = 0, colorScheme = 'default' }: BubbleGraphProps & { focus?: number; colorScheme?: 'default' | 'blue' }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodesRef = useRef<NodePoint[]>([])
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })
  const rafRef = useRef<number | null>(null)
  const displayProgressRef = useRef(0) // smoothed progress for gentle growth
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })

  // Rebuild nodes when progress or size changes
  const rebuild = () => {
    const { w, h } = sizeRef.current
    if (!w || !h) return
    const baseNodes = 24
    const maxAdd = 60
    const count = Math.max(8, Math.min(baseNodes + Math.round(progress * maxAdd), 120))
    const nodes: NodePoint[] = Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      r: 4 + Math.random() * 6, // base radius
      scale: 1.5,
    }))
    nodesRef.current = nodes
  }

  // Resize handling
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { w: Math.floor(rect.width), h: Math.floor(rect.height), dpr }
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      canvas.style.width = `${Math.floor(rect.width)}px`
      canvas.style.height = `${Math.floor(rect.height)}px`
      rebuild()
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', resize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Rebuild when progress changes
  useEffect(() => {
    rebuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  // Mouse listeners for hover interaction + parallax (canvas remains pointer-events none)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
      mouseRef.current.active = true

      // Parallax: translate the entire layer slightly opposite the cursor
      const container = containerRef.current
      if (container) {
        const vpW = window.innerWidth
        const vpH = window.innerHeight
        const cx = vpW / 2
        const cy = vpH / 2
        const dx = (e.clientX - cx) / cx // -1..1
        const dy = (e.clientY - cy) / cy // -1..1
        const max = 15 // px
        const tx = Math.max(-1, Math.min(1, -dx)) * max
        const ty = Math.max(-1, Math.min(1, -dy)) * max
        container.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
      }
    }
    const onLeave = () => {
      mouseRef.current.active = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // Apply scroll-linked blur/brightness based on focus prop (0..1)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const clamped = Math.max(0, Math.min(1, focus))
    const blurPx = 8 * clamped
    const brightness = 1 - 0.3 * clamped
    container.style.filter = `blur(${blurPx}px) brightness(${brightness})`
  }, [focus])

  // Animation loop
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { w, h, dpr } = sizeRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Smoothly ease display progress toward target
      const p = displayProgressRef.current + (progress - displayProgressRef.current) * 0.06
      displayProgressRef.current = p

      const connDist = 100 + p * 100
      const nodes = nodesRef.current
      const mouse = mouseRef.current

      // Color scheme
      const lineStroke = colorScheme === 'blue' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(136, 84, 208, 0.35)'
      const nodeFill = colorScheme === 'blue' ? 'rgba(59, 130, 246, 0.65)' : 'rgba(236, 72, 153, 0.65)'
      const nodeShadow = colorScheme === 'blue' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(236, 72, 153, 0.35)'

      // Determine how many bubbles should be in the "grown" state based on progress
      const grownCount = Math.max(0, Math.min(nodes.length, Math.floor(p * nodes.length)))

      // Update per-node target scales (no movement)
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        let target = i < grownCount ? 3.8 : 1.7
        if (mouse.active) {
          const rect = canvas.getBoundingClientRect()
          const dx = mouse.x - rect.left - n.x / dpr
          const dy = mouse.y - rect.top - n.y / dpr
          const dist = Math.hypot(dx, dy)
          const hoverRadius = 140
          if (dist < hoverRadius) {
            const boost = 0.9 * (1 - dist / hoverRadius)
            target += boost
          }
        }
        n.scale += (target - n.scale) * 0.1
      }

      // Connections
      ctx.save()
      ctx.lineWidth = 1.6
      ctx.strokeStyle = lineStroke
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < connDist * dpr) {
            const alpha = 0.35 * (1 - d / (connDist * dpr))
            ctx.globalAlpha = alpha
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      ctx.restore()

      // Nodes
      for (const n of nodes) {
        ctx.beginPath()
        ctx.fillStyle = nodeFill
        ctx.shadowColor = nodeShadow
        ctx.shadowBlur = 14
        ctx.arc(n.x, n.y, n.r * dpr * n.scale, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [progress])

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 -z-10 will-change-transform">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

export default BubbleGraph

