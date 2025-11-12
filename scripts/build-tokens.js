/* eslint-disable no-console */
/**
 * Build tokens → CSS variables
 * - Reads design/tokens.json
 * - Emits styles/tokens.css
 * - Gracefully works without style-dictionary installed
 */

const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const TOKENS_PATH = path.join(ROOT, 'design', 'tokens.json')
const OUT_DIR = path.join(ROOT, 'styles')
const OUT_FILE = path.join(OUT_DIR, 'tokens.css')

/** Convert a number to px string, leave strings as-is */
function withPx(value) {
  if (typeof value === 'number') return `${value}px`
  return value
}

/** Flatten nested objects with kebab-case keys joined by '-' */
function flattenTokens(obj, prefix = []) {
  const result = {}
  Object.entries(obj).forEach(([key, value]) => {
    const nextPath = [...prefix, key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).toLowerCase()]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value, nextPath))
    } else {
      result[nextPath.join('-')] = value
    }
  })
  return result
}

/** Hex to HSL string "h s% l%" for Tailwind hsl(var(--x)) usage */
function hexToHslString(hex) {
  let parsed = hex.replace('#', '')
  if (parsed.length === 3) {
    parsed = parsed
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const bigint = parseInt(parsed, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255
  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r1:
        h = (g1 - b1) / d + (g1 < b1 ? 6 : 0)
        break
      case g1:
        h = (b1 - r1) / d + 2
        break
      case b1:
        h = (r1 - g1) / d + 4
        break
    }
    h /= 6
  }
  const H = Math.round(h * 360)
  const S = Math.round(s * 100)
  const L = Math.round(l * 100)
  return `${H} ${S}% ${L}%`
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function buildCss(tokens) {
  const lines = []
  lines.push('/* Auto-generated from design/tokens.json — do not edit directly. */')
  lines.push(':root {')

  // Colors
  const colors = tokens.color || {}
  const bg = colors.bg || {}
  const fg = colors.fg || {}
  const colorVars = {
    'color-bg-base': bg.base,
    'color-bg-elev': bg.elev,
    'color-bg-muted': bg.muted,
    'color-bg-inverse': bg.inverse,
    'color-fg-base': fg.base,
    'color-fg-muted': fg.muted,
    'color-fg-accent': fg.accent,
    'color-fg-danger': fg.danger,
    'color-fg-success': fg.success,
    'color-fg-warn': fg.warn,
  }
  Object.entries(colorVars).forEach(([name, value]) => {
    if (value) lines.push(`  --${name}: ${value};`)
  })

  // Typography
  const type = tokens.typography || {}
  if (type.fontFamily?.sans) lines.push(`  --font-sans: ${type.fontFamily.sans};`)
  if (type.scale) {
    Object.entries(type.scale).forEach(([k, v]) => {
      lines.push(`  --font-size-${k}: ${withPx(v)};`)
    })
    // Useful defaults
    lines.push('  --line-height-body: 1.6;')
    lines.push('  --line-height-heading: 1.2;')
  }

  // Radius
  const radius = tokens.radius || {}
  Object.entries(radius).forEach(([k, v]) => {
    lines.push(`  --radius-${k}: ${withPx(v)};`)
  })
  if (radius.md) lines.push(`  --radius: ${withPx(radius.md)};`)

  // Shadows
  const shadow = tokens.shadow || {}
  Object.entries(shadow).forEach(([k, v]) => {
    lines.push(`  --shadow-${k}: ${v};`)
  })

  // Spacing (named and indexed)
  const space = tokens.space || []
  const spaceNames = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']
  space.forEach((val, i) => {
    lines.push(`  --space-${i}: ${withPx(val)};`)
    if (spaceNames[i]) {
      lines.push(`  --space-${spaceNames[i]}: ${withPx(val)};`)
    }
  })

  // Z-index
  const z = tokens.z || {}
  Object.entries(z).forEach(([k, v]) => {
    lines.push(`  --z-${k}: ${v};`)
  })

  // Motion
  const motion = tokens.motion || {}
  if (typeof motion.fast === 'number') lines.push(`  --motion-fast: ${motion.fast}ms;`)
  if (typeof motion.base === 'number') lines.push(`  --motion-base: ${motion.base}ms;`)
  if (typeof motion.slow === 'number') lines.push(`  --motion-slow: ${motion.slow}ms;`)
  if (motion.curve) lines.push(`  --motion-curve: ${motion.curve};`)

  // Breakpoints
  const bp = tokens.breakpoint || {}
  Object.entries(bp).forEach(([k, v]) => {
    lines.push(`  --bp-${k}: ${withPx(v)};`)
  })

  lines.push('}')

  // Theme aliases for current Tailwind mapping (hsl(var(--x))) — non-destructive defaults
  // These derive HSL values from provided hex tokens; adjust later if you expand tokens.
  if (bg.base && fg.base) {
    const backgroundHsl = hexToHslString('#ffffff') // default light
    const foregroundHsl = hexToHslString('#0b0b0c')
    const cardHsl = backgroundHsl
    const mutedHsl = hexToHslString('#f3f4f6')
    const accentHsl = hexToHslString(fg.accent || '#4E9BF5')
    const borderHsl = hexToHslString('#e5e7eb')

    lines.push('')
    lines.push(':root {')
    lines.push(`  --background: ${backgroundHsl};`)
    lines.push(`  --foreground: ${foregroundHsl};`)
    lines.push(`  --card: ${cardHsl};`)
    lines.push(`  --card-foreground: ${foregroundHsl};`)
    lines.push(`  --popover: ${cardHsl};`)
    lines.push(`  --popover-foreground: ${foregroundHsl};`)
    lines.push(`  --primary: ${accentHsl};`)
    lines.push(`  --primary-foreground: ${hexToHslString('#ffffff')};`)
    lines.push(`  --secondary: ${mutedHsl};`)
    lines.push(`  --secondary-foreground: ${foregroundHsl};`)
    lines.push(`  --muted: ${mutedHsl};`)
    lines.push(`  --muted-foreground: ${hexToHslString('#6b7280')};`)
    lines.push(`  --accent: ${accentHsl};`)
    lines.push(`  --accent-foreground: ${foregroundHsl};`)
    lines.push(`  --destructive: ${hexToHslString('#ef4444')};`)
    lines.push(`  --destructive-foreground: ${hexToHslString('#ffffff')};`)
    lines.push(`  --border: ${borderHsl};`)
    lines.push(`  --input: ${borderHsl};`)
    lines.push(`  --ring: ${accentHsl};`)
    lines.push(`  --chart-1: ${hexToHslString('#2563eb')};`)
    lines.push(`  --chart-2: ${hexToHslString('#16a34a')};`)
    lines.push(`  --chart-3: ${hexToHslString('#f59e0b')};`)
    lines.push(`  --chart-4: ${hexToHslString('#d946ef')};`)
    lines.push(`  --chart-5: ${hexToHslString('#ef4444')};`)
    lines.push('}')

    // Dark theme aliases (approximate) based on tokens
    lines.push('')
    lines.push('[data-theme="dark"] {')
    lines.push(`  --background: ${hexToHslString(bg.base)};`)
    lines.push(`  --foreground: ${hexToHslString(fg.base)};`)
    lines.push(`  --card: ${hexToHslString(bg.elev || bg.base)};`)
    lines.push(`  --card-foreground: ${hexToHslString(fg.base)};`)
    lines.push(`  --popover: ${hexToHslString(bg.elev || bg.base)};`)
    lines.push(`  --popover-foreground: ${hexToHslString(fg.base)};`)
    lines.push(`  --primary: ${hexToHslString(fg.accent || '#4E9BF5')};`)
    lines.push(`  --primary-foreground: ${hexToHslString('#0b0b0c')};`)
    lines.push(`  --secondary: ${hexToHslString(bg.muted || '#1A1A1F')};`)
    lines.push(`  --secondary-foreground: ${hexToHslString(fg.base)};`)
    lines.push(`  --muted: ${hexToHslString(bg.muted || '#1A1A1F')};`)
    lines.push(`  --muted-foreground: ${hexToHslString(fg.muted || '#A1A1AA')};`)
    lines.push(`  --accent: ${hexToHslString(fg.accent || '#4E9BF5')};`)
    lines.push(`  --accent-foreground: ${hexToHslString('#0b0b0c')};`)
    lines.push(`  --destructive: ${hexToHslString('#ef4444')};`)
    lines.push(`  --destructive-foreground: ${hexToHslString('#ffffff')};`)
    lines.push(`  --border: ${hexToHslString('#27272a')};`)
    lines.push(`  --input: ${hexToHslString('#27272a')};`)
    lines.push(`  --ring: ${hexToHslString(fg.accent || '#4E9BF5')};`)
    lines.push('}')
  }

  // Reduced motion accommodations
  lines.push('')
  lines.push('@media (prefers-reduced-motion: reduce) {')
  lines.push('  :root {')
  lines.push('    --motion-curve: linear;')
  lines.push('  }')
  lines.push('}')

  return lines.join('\n')
}

function main() {
  const raw = fs.readFileSync(TOKENS_PATH, 'utf8')
  const tokens = JSON.parse(raw)
  ensureDir(OUT_DIR)
  const css = buildCss(tokens)
  fs.writeFileSync(OUT_FILE, `${css}\n`, 'utf8')
  console.log(`✓ Tokens built → ${path.relative(ROOT, OUT_FILE)}`)
}

main()


