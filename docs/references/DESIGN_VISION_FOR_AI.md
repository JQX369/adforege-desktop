# 🎁 Fairy Wize – UI & Design Vision (AI Brief)

## I. PRODUCT ESSENCE & POSITIONING

**What is Fairy Wize?**
A "gift intuition engine"—a delightful, fast, and intelligent way to solve the universal problem of gift-giving indecision. It combines conversational intelligence (a caring questionnaire), swipe-based discovery (TikTok-like UX), and commerce integration (affiliate + vendor listings) into one joyful flow.

**North Star:** Users should feel like they have a wise, approachable friend who _gets_ them, never a corporate algorithm.

**Core Promise:** "Perfect gifts in minutes, not hours."

---

## II. USER PERSONAS & MENTAL MODELS

### **1. The Gift Giver (Primary User)**

- **Psychology:** Wants to be thoughtful but is often overwhelmed by choice. Feels pressure to find something "perfect."
- **Trigger:** Birthday/holiday reminder → "Oh no, what do I get?" → Opens Fairy Wize
- **Goal:** Receive 3–5 concrete recommendations they feel confident about
- **Pain Point:** Too many options, unclear how recommendations work, fear of wasting money
- **Interaction Archetype:** _Quick, intuitive, low-friction._ Micro-commitments (each question takes <10 seconds). Reassurance at every step.

### **2. The Recipient Proxy (Form Questions)**

- **Mental Model:** The gift giver is _describing someone else_ to the system
- **Context:** Form questions are intimate (age, personality, budget) but also playful—should feel like telling a friend about someone, not filling a database.
- **Design Implication:** Questions should build narrative, not feel robotic.

### **3. The Vendor (Secondary User)**

- **Psychology:** Needs affordable, low-barrier entry to reach gift buyers
- **Goal:** Submit a product in <3 minutes, see it live, track performance
- **Design Implication:** Frictionless onboarding, instant feedback, clear tier benefits

### **4. The Site Visitor (Pre-Committed)**

- **Mental Model:** Landing page is "proof" that this is real, safe, and worth trying
- **Goal:** Quick skim, CTA click, form start
- **Design Implication:** Hero + social proof + one crystal-clear CTA

---

## III. CORE INTERACTION PATTERNS

### **Pattern 1: The Questionnaire (Form) → Aha Moment**

**Conceptual Idea:**

- Conversational, non-threatening, builds anticipation
- Each answer _narrows_ the gift universe, making the problem smaller
- Visual progress (step indicator) shows "you're almost there"
- After submit → _instant_ results (even if it's a loading state with a warm message)

**Design Philosophy:**

- "Question by question, we're getting closer to their perfect gift."
- Micro-feedback: hover states, subtle animations, validation that encourages
- No big forms; no walls of fields; no jargon

### **Pattern 2: The Swipe Deck → Discovery & Joy**

**Conceptual Idea:**

- Swiping is _decisive_. Left = "nope," Right = "yes, save this."
- Each card should feel like a fresh discovery, not a ranked list
- Swipe is the opposite of the form: _instant, embodied, playful_
- Visual feedback (gradient burn, card disappear) reinforces action

**Design Philosophy:**

- "You're not scrolling through a catalog; you're saying yes/no to real gifts."
- Interaction is _haptic_ in nature even on desktop (metaphor of flicking)
- No analysis paralysis; keep swiping = keep discovering

### **Pattern 3: Saved Drawer → Ownership & Curation**

**Conceptual Idea:**

- A personal curation of gifts _they_ liked
- Low friction to revisit, compare, or share
- Could become a shared list (future), but today: personal record

**Design Philosophy:**

- "Your shortlist of gifts you love."
- Subtle reminder of _when_ they liked it (recently saved = fresh, timely)

---

## IV. VISUAL & MOTION LANGUAGE

### **Color Palette & Mood**

**Primary Vibe:** Warm, playful, trustworthy—_not_ sterile or corporate.

- **Primary Accent:** Soft, warm gold/rose gradient (approachable, premium feel)
- **Background:** Clean white or soft blurred gradient (gives breathing room)
- **Text:** Dark charcoal/navy (readable, friendly—not black)
- **Accent Highlights:** Soft shadows, subtle glow effects (modern, friendly)

**Rationale:**

- Gold = gift, celebration, warmth
- Soft gradients = modern but not cold
- Generous whitespace = calm, not cluttered

### **Typography & Hierarchy**

- **Headlines:** Warm, approachable serif or modern sans (e.g., Inter, Plus Jakarta)
  - "Find the perfect gift" vs. "Recommendation Engine"
  - Aim for 48–56px on hero, 24–32px on cards
- **Body Text:** Clear, readable sans-serif (Inter, 16–18px on mobile)
- **Microcopy:** Friendly, encouraging tone
  - ✅ "You're almost there—one more step!"
  - ❌ "Please complete required fields."

### **Motion & Animation**

- **Form Steps:** Gentle fade/slide in (respect `prefers-reduced-motion`)
- **Swipe Cards:** Immediate visual feedback (gradient burn, card lift, then exit)
- **Buttons:** Subtle scale/glow on hover
- **Loading States:** Warm skeleton pulse, not cold spinners
- **Overall:** Motion should feel _encouraging_, not flashy

**Guiding Principle:** Every animation should reinforce _progress_ or _joy_, never distract.

---

## V. INFORMATION ARCHITECTURE & FLOWS

### **Public Homepage (Landing)**

**Sections (in order):**

1. **Hero** – Headline, subheadline, single primary CTA ("Find Your Gift")
2. **Trust Row** – Star rating, Amazon/eBay logos, simple social proof (e.g., "Trusted by 10k+ gifters")
3. **Feature Cards** – 3 visual cards explaining _why_ Fairy Wize works (quick, smart, joy-filled)
4. **Testimonials** – 3–4 customer quotes (keep it real, not corporate)
5. **Swipe Demo** – Animated or static mockup of the swipe interaction
6. **Guides CTA** – Optional: Link to curated gift guides (/gift-guides)
7. **FAQ / Footer** – Links, legal, affiliate disclosure

**Design Principle:** Entry → _belief_ → _action_ (CTA click)

### **Questionnaire Flow**

**Architecture:**

1. **Hero Section** (tells them what's coming) – "Answer a few quick questions"
2. **Multi-Step Form** (questions 1–8 approx.)
   - Each step: one question, radio/multi-select, auto-advance on single select
   - Progress bar at top
   - "Back" always available
3. **Review Step (optional)** – Show their answers, allow edit
4. **Submit** → Loading (warm message) → Results

**Design Principle:** Clarity + momentum + reassurance

### **Swipe Deck Flow**

**Architecture:**

1. **Deck Card** (top)
   - Image (large, prominent)
   - Title, price, category badge
   - CTA: "Like/Save" (right) or "Pass" (left)
   - Swipe tip: "Swipe left to pass, right to like"
2. **Saved Counter** (top-right) – Badge showing # saved
3. **Buttons (accessibility fallback)** – X and ❤️ buttons below card
4. **Load More** – When deck runs out, "Load More" button

**Design Principle:** Visual clarity + embodied interaction + always-visible progress

### **Vendor Portal (Lite)**

**Flow:**

1. **Sign In** → Simple magic link or email
2. **Dashboard** (overview)
   - Tier (Basic/Featured/Premium)
   - Impressions, clicks, conversion
   - "Manage Products" link
3. **Product Submit**
   - Form (title, description, image, price, URL)
   - Price plan selector (if ready to upgrade)
   - Stripe checkout
4. **Product List**
   - Table or cards
   - Edit/delete actions
   - Status badge (Active/Pending/Rejected)

**Design Principle:** Effortless onboarding, instant feedback, clear next steps

---

## VI. KEY DESIGN PRINCIPLES

### **1. Conversational, Not Corporate**

- Use "you" and "them," not "user" or "recipient"
- Warm, encouraging microcopy ("You're so close!" vs. "Submit form")
- Playful icons and illustrations where appropriate

### **2. Fast & Frictionless**

- No unnecessary steps or fields
- Form: max 1–2 fields per step
- Swipe: instant visual feedback
- Results: visible within 2 seconds of submit

### **3. Transparency & Trust**

- Show where recommendations come from (Amazon, eBay, curated vendors)
- Disclose affiliates ("We earn a small commission…") but frame as enabling this to stay free
- No hidden features or paywalls on core flow

### **4. Mobile-First & Responsive**

- 360px viewport = baseline (iPhone 5-ish widths)
- Touch targets: minimum 44px × 44px
- Swipe deck: full-width on mobile, centered on desktop
- Form: single column on mobile, optional multi-col on desktop

### **5. Accessibility & Inclusion**

- WCAG AA minimum compliance
- Proper heading hierarchy, ARIA labels
- Color contrast ≥ 4.5:1 on text
- Keyboard navigation throughout
- Respect `prefers-reduced-motion` and `prefers-color-scheme`

### **6. Performance & Delight**

- Aim for 90+ Lighthouse score
- Images lazy-loaded, optimized
- Loading states feel warm, not cold
- No jank on swipe interactions

---

## VII. COMPONENT INVENTORY & BEHAVIORS

### **Reusable Components**

| Component          | Role                  | Behavior                                                   |
| ------------------ | --------------------- | ---------------------------------------------------------- |
| **Card**           | Contain content       | Shadow, hover lift, rounded corners                        |
| **Button**         | Call to action        | Ghost (outline) or solid; glow on hover                    |
| **Input / Select** | Form capture          | Clear label, hint text, validation feedback                |
| **Badge**          | Label / status        | Subtle background, small pill shape                        |
| **Drawer / Sheet** | Overlay content       | Smooth slide in from side/bottom; dismiss on outside click |
| **Progress Bar**   | Show completion       | Smooth animation, warm color                               |
| **Icon**           | Visual aid            | Simple, friendly, 24–32px sizes                            |
| **Image**          | Product / testimonial | Aspect ratio lock, skeleton loading, fallback              |
| **Button Group**   | Swipe actions         | Two buttons (Pass / Like), large touch targets             |

**Design Principle:** Components are _consistent_ but never _identical_—they adapt to context while following a unified language.

---

## VIII. TONE & VOICE

### **Tone Pillars**

1. **Warm:** "I'm here to help, not judge."
2. **Encouraging:** "You're doing great! Keep going."
3. **Playful:** Emojis when natural, humor when timely
4. **Honest:** No hype; clear about what we do and don't know

### **Example Microcopy**

| Context          | ✅ DO                               | ❌ DON'T                              |
| ---------------- | ----------------------------------- | ------------------------------------- |
| Form instruction | "Tell us about the lucky person"    | "Enter recipient demographics"        |
| Validation error | "Oops—need at least 3 interests"    | "INVALID INPUT: interests.length < 3" |
| Empty state      | "No saved gifts yet—start swiping!" | "No results"                          |
| Loading          | "Finding the perfect gift…"         | "Loading…"                            |
| Testimonial      | "Jessica, NYC"                      | "Verified Purchase Badge"             |

---

## IX. PRODUCT-LEVEL GOALS & METRICS

### **Success Criteria (Product Level)**

1. **Conversion:** 30%+ of home visitors → form start
2. **Form Completion:** 70%+ form starts → results
3. **Engagement:** 2.5+ average saves per session
4. **Repeat:** 15%+ return visitors (tracked via saved drawer shares)
5. **Vendor NPS:** 8+ on "How likely to refer?" (after first product)

### **Design Supports These Via**

- Hero CTA prominent, obvious
- Form feels rewarding (progress, no friction)
- Swipe is _addictive_ (easy swiping, visual feedback)
- Saved drawer enables sharing
- Vendor flow: instant publish, visible metrics

---

## X. ANTI-PATTERNS (WHAT NOT TO DO)

❌ **Dark mode by default** – Gift-giving is warm, not moody
❌ **Heavy animations** – Distracting, not delightful
❌ **Cluttered layouts** – Whitespace is your friend
❌ **Corporate copy** – No buzzwords like "leverage," "synergy," "ecosystem"
❌ **Passive voice** – "A gift was liked" vs. "You liked this gift"
❌ **Unclear CTAs** – "Learn more" is vague; "Start finding gifts" is clear
❌ **Pink-only aesthetic** – Too gendered; use gold + warm neutrals

---

## XI. TECHNICAL CONSTRAINTS & OPPORTUNITIES

### **Built With**

- Next.js 14 (React)
- Tailwind CSS (utility-first, customizable)
- shadcn/ui (accessible component library)
- Prisma (type-safe DB access)
- Supabase (serverless DB)

### **Opportunities**

- Tailwind design tokens for easy theming
- React hooks + context for form state
- Next/Image for optimized image loading
- Vercel Edge for fast API response

### **Constraints**

- No custom fonts (use system or web-safe serif/sans)
- Images must come from approved sources (Amazon, eBay, vendor URLs)
- Mobile must work on 360px+ widths (iPhones from ~2015+)

---

## XII. EVOLUTION & FUTURE VISION

### **Phase 1 (Today)** – "The Joy of Quick Discovery"

- Landing + hero + social proof
- Questionnaire + instant results
- Swipe deck + saved drawer
- Vendor onboarding (basic)

### **Phase 2 (Next)** – "Personalization & Sharing"

- Save and resume form (draft recovery)
- Share recommendations with friends (social)
- Gift guides (curation)
- Vendor tier benefits (Featured, Premium)

### **Phase 3 (Later)** – "Community & Loyalty"

- User wishlists / gift registries
- Vendor reviews / testimonials (vendor-to-vendor)
- Repeat gifter profiles ("You loved these brands…")
- Affiliate recommendations ("Based on your last gift…")

---

## XIII. HANDOFF INSTRUCTIONS FOR UI AI

### **Your Task**

Using the mental models, principles, and component guidelines above, redesign the Fairy Wize UI to:

1. **Feel more cohesive** – Every section should reinforce the gift-giving delight narrative
2. **Be more playful** – Warm colors, encouraging microcopy, delightful micro-interactions
3. **Increase clarity** – Crystal-clear CTAs, visual hierarchy, zero confusion on "what to do next"
4. **Maintain performance** – Keep Lighthouse scores high; no bloat
5. **Stay accessible** – WCAG AA minimum; mobile-first; responsive everywhere

### **What to Keep**

- Core flows: landing → form → swipe → saved → vendor
- Component structure (GiftForm, SwipeDeck, ProductCard, etc.)
- Database schema and API endpoints (no backend changes)
- Performance budget (90+ Lighthouse)

### **What to Evolve**

- Visual hierarchy and spacing (tighter, more intentional)
- Color palette (warmer, more consistent)
- Microcopy (friendlier, more encouraging)
- Form UX (smoother step transitions, clearer progress)
- Swipe experience (better visual feedback, card stacking)
- Landing page (stronger hero, better social proof placement)

### **Success Metrics (Post-Redesign)**

- 🎨 Visual consistency across all pages
- ⚡ Form completion +10% (via better UX)
- 💾 Saves per session +15% (via better swipe feedback)
- 📱 Mobile Lighthouse ≥92
- ♿ WCAG AA compliance confirmed

---

## XIV. ASSETS & RESOURCES

### **Brand Assets**

- Logo: [location or brief description]
- Color palette: Gold (#FDB022) / Rose (#E8B4B8) / Navy (#1A2B3C) / White (#FAFAF8)
- Typography: Inter (body), Plus Jakarta Sans (headlines) – or fallback to system fonts

### **Reference Pages / Components**

- Landing: `app/page.tsx` + `components/site/*`
- Form: `components/GiftForm.tsx`
- Swipe: `components/SwipeDeck.tsx`
- Saved: `components/SavedDrawer.tsx`
- Vendor: `app/vendor/page.tsx`

### **Documentation**

- Color tokens: `app/globals.css`, `tailwind.config.ts`
- Component library: shadcn/ui (Tailwind + Radix primitives)
- Design system: [link to Figma or design docs, if available]

---

## XV. QUICK REFERENCE: DESIGN SYSTEM

### **Spacing Scale** (Tailwind defaults, optional custom)

`4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px`

### **Typography Scale**

- **Display:** 48–56px (hero headlines)
- **Heading 1:** 32–40px (section titles)
- **Heading 2:** 20–24px (subsections)
- **Body:** 16–18px (content)
- **Caption:** 12–14px (metadata, hints)

### **Breakpoints** (Tailwind)

- **Mobile:** 0–640px (sm)
- **Tablet:** 641–1024px (md/lg)
- **Desktop:** 1025px+ (xl+)

### **Shadows** (for depth)

- **sm:** `0 1px 2px rgba(0,0,0,0.05)`
- **md:** `0 4px 6px rgba(0,0,0,0.1)`
- **lg:** `0 10px 15px rgba(0,0,0,0.1)`

### **Borders & Radius**

- **Radius:** 8px (cards), 4px (inputs), 50% (avatars)
- **Border:** 1px solid `#e5e7eb` (light gray)

---

## XVI. FINAL WORDS FOR THE AI

You are not building a "_gift site_"—you're crafting a _feeling_.

Fairy Wize is the moment when someone stops worrying and starts imagining the _joy on the recipient's face_. Every design decision—from the warmth of the gold to the smoothness of a swipe—should reinforce that feeling.

Think like a friend who gets gifting. Be warm. Be fast. Be clear. Be delightful.

**Now go build something beautiful.** ✨🎁
