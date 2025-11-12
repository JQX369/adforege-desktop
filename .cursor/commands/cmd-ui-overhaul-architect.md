# UI Overhaul Architect — From First Principles to Shippable Plan

## Goal
Redesign the app/site UI from first principles to something simpler, faster, and more legible. 
Define the information architecture, design language (tokens, components, motion), key screens, micro-interactions, and a concrete build plan.

## Inputs
- Product one-liner: {{mission}}
- Primary users & top 5 jobs-to-be-done (JTBD): {{users_jtbd}}
- 3 benchmark apps (why they work): {{benchmarks}}
- Non-negotiables (brand, tech, SEO, a11y, perf): {{constraints}}
- Tech stack (UI): {{stack|Next.js + React + Tailwind + shadcn/ui}}
- Content tone (short): {{tone|confident, friendly, concise}}

## First Principles (think before pixels)
1) What is the *core loop*? (open → do X → get value → share/return)
2) What can be removed without losing that loop?
3) What must be visible *by default* vs discoverable on demand?
4) What 3 emotions should the UI evoke? (map them to color, motion, copy)
5) Accessibility & speed minimums: WCAG AA, LCP <2.5s, INP <200ms.

## Produce (Artifacts)
1) **Information Architecture (IA)**
   - Top-level nav (5-7 items max), secondary nav, and empty-state flows.
   - Route map + permissions states (signed-out, signed-in, error, 404).
2) **Design Language System (DLS)**
   - **Design Tokens** (JSON): color, typography, spacing, radii, shadows, z, motion, breakpoints, theme (light/dark/brand-X).
   - **Components** (atomic → composite): Button, Input, Select, Modal/Sheet, Toast, Card, Table, Chart, Empty, Error, Skeleton.
   - **Motion System** (ms + curves): enter/exit, hover, press, async transitions.
   - **Micro-Interactions**: hover, press, focus, async (loading/success/error), confetti for success (sparingly).
3) **Screens & States**
   - 5–8 “hero” screens that cover 80% usage; each with loading/empty/error.
   - Mobile first, then tablet, then desktop (≤4 breakpoints).
   - Dark mode parity.
4) **Copy System**
   - Voice & tone rules, microcopy patterns, success/error templates.
5) **Build Plan**
   - 3 phases (Foundation → Feature Shells → Polish), each 3–5 steps.
   - Storybook coverage target (≥80% of components with states).
   - Lint rules for a11y, import/order, and motion limits.

## How to Think (Heuristics)
- Reduce choices on every screen (1 primary, 1 secondary action).
- Respect Fitts’s law (tap targets ≥44px), 12/16/24 spacing rhythm.
- Motion aids meaning (100–250ms). Use easing: standard, emphasized, decel.
- Prefer progressive disclosure over extra pages.
- Make *errors and empties* as deliberate as the happy path.

## Design Tokens (emit as JSON)
Create/modify `/design/tokens.json`:
{
  "color": {
    "bg": {"base":"#0B0B0C","elev":"#111114","muted":"#1A1A1F","inverse":"#FFFFFF"},
    "fg": {"base":"#EDEDEF","muted":"#A1A1AA","accent":"#4E9BF5","danger":"#EF4444","success":"#22C55E","warn":"#F59E0B"}
  },
  "typography": {
    "fontFamily": {"sans":"Inter, ui-sans-serif, system-ui"},
    "scale": {"xs":12,"sm":14,"base":16,"lg":18,"xl":20,"2xl":24,"3xl":30}
  },
  "radius": {"sm":8,"md":14,"lg":20,"xl":24},
  "shadow": {"sm":"0 1px 2px rgba(0,0,0,.12)","md":"0 6px 20px rgba(0,0,0,.22)"},
  "space": [4,8,12,16,20,24,32,40],
  "z": {"nav":10,"overlay":100,"toast":110,"modal":120},
  "motion": {"fast":120,"base":180,"slow":240,"curve":"cubic-bezier(.2,.8,.2,1)"},
  "breakpoint": {"sm":360,"md":640,"lg":1024,"xl":1280},
  "theme": {"modes":["light","dark"]}
}

Wire tokens:
- Tailwind: map tokens in `tailwind.config.js` (colors, radius, shadow, font).
- CSS vars: emit `:root` + `[data-theme="dark"]` from tokens.

## Component Contract Template (use consistently)
**Props**: size, variant, state (idle|loading|success|error), iconLeft, iconRight, aria-label.
**Anatomy**: container → content → affordance → hint/error.
**States**: default, hover, active, focus-visible, disabled, loading.
**A11y**: roles, aria-*, focus trap (dialogs), escape to close, reduced motion.
**Tests**: render, keyboard nav, a11y (axe), visual snap (Storybook).

## Micro-Interactions (default set)
- Hover: subtle lift (translateY(-1px), shadow-sm, 120ms).
- Press: compress (scale .98), ripple/light highlight optional (80–120ms).
- Async: optimistic update where safe; toast with undo for destructive.
- Skeleton: 2–3 lines, 1 image block, shimmer 1200ms.
- Empty: icon + one-line + primary CTA; never pure blank.

## Deliverables (Output Format)
- IA Map (routes, nav, state variants)
- DLS (tokens.json, component list with props & states)
- Motion spec (numbers, curves, usage)
- Screen list with acceptance criteria per screen
- Phase plan with story breakdown (tickets)
- Copy snippets (success/error/empty)
- “Do next” commands (see below)

## Do Next (copy/paste)
- Init Storybook: `npx storybook init --builder vite || npx storybook init`
- Install shadcn/ui: `npx shadcn-ui@latest init -d && npx shadcn-ui@latest add button input dialog toast`
- Token plumbing: `npm i style-dictionary -D && node scripts/build-tokens.js`
- A11y: `npm i @axe-core/react jest-axe -D`
- Motion: `npm i framer-motion`
- Charts (if needed): `npm i recharts`

## Optional — AI Visual Brief (use to generate hero comps)
“Design a {{{tone}}} interface for {{mission}}. Use the provided tokens (colors/typography/radius/shadow). Focus on one primary action per screen, progressive disclosure, and micro-interactions per spec. Produce 3 variants for: Landing, Dashboard, Create-Flow Step, Detail page, Settings. Include light/dark and mobile/desktop. Annotate spacing and motion.”
