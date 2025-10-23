# 🚀 FairyWize Launch Readiness Plans

## Overview

Comprehensive implementation plans for making FairyWize world-class, simple, valuable, bug-free, streamlined, SEO-optimized, and scalable.

---

## 📈 1. SEO OPTIMIZATION PLAN

### Current State Analysis

- ✅ Basic meta tags in `app/layout.tsx`
- ✅ Structured data schemas in `lib/schema.ts`
- ✅ Google Analytics integration
- ❌ Missing dynamic meta tags per page
- ❌ No sitemap.xml generation
- ❌ No robots.txt
- ❌ Limited Open Graph optimization

### Implementation Tasks

#### 1.1 Dynamic Meta Tags System

**Files:** `app/layout.tsx`, `lib/metadata.ts`, `app/*/page.tsx`

```typescript
// lib/metadata.ts
export function generatePageMetadata({
  title,
  description,
  keywords,
  path,
  image,
}: PageMetadataParams): Metadata {
  return {
    title: `${title} | FairyWize`,
    description,
    keywords: [...DEFAULT_KEYWORDS, ...keywords],
    openGraph: {
      title: `${title} | FairyWize`,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}${path}`,
      images: [image || '/og-default.jpg'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | FairyWize`,
      description,
      images: [image || '/og-default.jpg'],
    },
  }
}
```

#### 1.2 Sitemap Generation

**File:** `app/sitemap.xml/route.ts`

```typescript
export async function GET() {
  const products = await prisma.product.findMany({
    select: { id: true, updatedAt: true },
    where: { status: 'APPROVED' },
  })

  const pages = [
    { url: '/', lastModified: new Date() },
    { url: '/gift-guides', lastModified: new Date() },
    { url: '/about', lastModified: new Date() },
    ...products.map((p) => ({
      url: `/product/${p.id}`,
      lastModified: p.updatedAt,
    })),
  ]

  return new Response(generateSitemap(pages), {
    headers: { 'Content-Type': 'application/xml' },
  })
}
```

#### 1.3 Robots.txt

**File:** `app/robots.txt/route.ts`

```typescript
export async function GET() {
  return new Response(
    `
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /vendor/
Sitemap: ${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml
  `,
    {
      headers: { 'Content-Type': 'text/plain' },
    }
  )
}
```

#### 1.4 Enhanced Structured Data

**File:** `lib/schema.ts` (extend existing)

```typescript
export const productSchema = (product: Product) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.title,
  description: product.description,
  image: product.images,
  offers: {
    '@type': 'Offer',
    price: product.price,
    priceCurrency: product.currency || 'GBP',
    availability:
      product.availability === 'IN_STOCK' ? 'InStock' : 'OutOfStock',
  },
  aggregateRating: product.rating
    ? {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.numReviews,
      }
    : undefined,
})
```

### Success Criteria

- [ ] All pages have unique, descriptive meta titles (50-60 chars)
- [ ] All pages have meta descriptions (150-160 chars)
- [ ] Sitemap.xml includes all public pages
- [ ] Robots.txt allows crawling of public content
- [ ] Structured data validates in Google's Rich Results Test
- [ ] Open Graph images render correctly on social platforms

### Timeline: 2-3 days

---

## ⚡ 2. PERFORMANCE OPTIMIZATION PLAN

### Current State Analysis

- ✅ Next.js Image component usage
- ✅ Basic code splitting
- ❌ No image optimization (WebP/AVIF)
- ❌ No caching strategy
- ❌ Bundle size not optimized
- ❌ No Core Web Vitals monitoring

### Implementation Tasks

#### 2.1 Image Optimization

**Files:** `next.config.js`, `components/ui/Image.tsx`

```typescript
// next.config.js (extend existing)
const nextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
}
```

#### 2.2 Bundle Analysis & Optimization

**Files:** `package.json`, `scripts/analyze-bundle.js`

```bash
# Add to package.json
"analyze": "ANALYZE=true next build",
"bundle-report": "npx @next/bundle-analyzer"
```

#### 2.3 Caching Strategy

**Files:** `lib/cache.ts`, `app/api/*/route.ts`

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached) return cached

  const data = await fetcher()
  await redis.setex(key, ttl, data)
  return data
}
```

#### 2.4 Core Web Vitals Monitoring

**Files:** `lib/analytics.ts`, `app/layout.tsx`

```typescript
// lib/analytics.ts
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label === 'web-vital') {
    gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
    })
  }
}
```

### Success Criteria

- [ ] Lighthouse Performance Score > 90
- [ ] LCP < 2.5 seconds
- [ ] FID < 100 milliseconds
- [ ] CLS < 0.1
- [ ] Bundle size < 500KB (initial)
- [ ] Images served in WebP/AVIF format

### Timeline: 3-4 days

---

## 🔒 3. SECURITY HARDENING PLAN

### Current State Analysis

- ✅ Basic input validation
- ✅ Supabase authentication
- ❌ No rate limiting on API endpoints
- ❌ Missing security headers
- ❌ No CSRF protection
- ❌ Limited input sanitization

### Implementation Tasks

#### 3.1 Rate Limiting

**Files:** `lib/rate-limit.ts`, `app/api/*/route.ts`

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
})

export async function checkRateLimit(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success, limit, reset, remaining } = await ratelimit.limit(ip)

  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  return { success, limit, reset, remaining }
}
```

#### 3.2 Security Headers

**Files:** `next.config.js` (extend existing)

```typescript
// next.config.js
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()'
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.openai.com https://api.ebay.com https://api.rainforestapi.com;"
        }
      ]
    }
  ]
}
```

#### 3.3 Input Sanitization

**Files:** `lib/sanitize.ts`, `app/api/*/route.ts`

```typescript
// lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'
import { z } from 'zod'

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: [],
  })
}

export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim()
}

export const GiftFormSchema = z.object({
  relationship: z.string().min(1).max(100),
  ageRange: z.string().min(1).max(50),
  gender: z.enum(['male', 'female', 'other']),
  occasion: z.string().min(1).max(100),
  budget: z.string().min(1).max(50),
  interests: z.array(z.string().max(100)).max(10),
  personality: z.string().min(1).max(100),
  living: z.string().min(1).max(100),
  giftType: z.string().min(1).max(100),
  avoid: z.array(z.string().max(100)).max(10),
  requirements: z.string().max(500),
  context: z.string().max(1000),
})
```

#### 3.4 CSRF Protection

**Files:** `lib/csrf.ts`, `app/api/*/route.ts`

```typescript
// lib/csrf.ts
import { createHash, randomBytes } from 'crypto'

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateCSRFToken(token: string, secret: string): boolean {
  const expectedToken = createHash('sha256')
    .update(secret + process.env.CSRF_SECRET)
    .digest('hex')

  return token === expectedToken
}
```

### Success Criteria

- [ ] All API endpoints have rate limiting
- [ ] Security headers implemented and tested
- [ ] Input validation on all user inputs
- [ ] CSRF protection on state-changing operations
- [ ] Security audit passes with no critical issues

### Timeline: 2-3 days

---

## 📱 4. MOBILE OPTIMIZATION PLAN

### Current State Analysis

- ✅ Responsive design with Tailwind
- ✅ Touch-friendly swipe interface
- ❌ No mobile-specific performance optimizations
- ❌ Limited mobile UX testing
- ❌ No Progressive Web App features

### Implementation Tasks

#### 4.1 Mobile Performance

**Files:** `next.config.js`, `app/layout.tsx`

```typescript
// next.config.js
const nextConfig = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@heroicons/react'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}
```

#### 4.2 Progressive Web App

**Files:** `public/manifest.json`, `app/layout.tsx`

```json
// public/manifest.json
{
  "name": "FairyWize - AI Gift Finder",
  "short_name": "FairyWize",
  "description": "Find perfect gifts with AI-powered recommendations",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#8b5cf6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 4.3 Mobile UX Enhancements

**Files:** `components/GiftForm.tsx`, `components/SwipeDeck.tsx`

```typescript
// Enhanced mobile form experience
const MobileFormWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 md:hidden">
      {children}
    </div>
  )
}

// Improved touch interactions
const SwipeCard = ({ onSwipe }: { onSwipe: (direction: 'left' | 'right') => void }) => {
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Enhanced touch handling for mobile
  }, [])

  return (
    <div
      className="touch-none select-none"
      onTouchStart={handleTouchStart}
    >
      {/* Card content */}
    </div>
  )
}
```

#### 4.4 Mobile Analytics

**Files:** `lib/analytics.ts`

```typescript
// Track mobile-specific metrics
export function trackMobileEvent(event: string, data?: any) {
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )

  if (isMobile) {
    gtag('event', `mobile_${event}`, {
      ...data,
      device_type: 'mobile',
    })
  }
}
```

### Success Criteria

- [ ] Mobile Lighthouse Score > 90
- [ ] Touch interactions feel native
- [ ] PWA installable on mobile devices
- [ ] Mobile-specific analytics implemented
- [ ] Mobile conversion rate optimized

### Timeline: 3-4 days

---

## ♿ 5. ACCESSIBILITY COMPLIANCE PLAN

### Current State Analysis

- ✅ Semantic HTML structure
- ✅ Basic keyboard navigation
- ❌ No screen reader testing
- ❌ Limited color contrast compliance
- ❌ No focus management

### Implementation Tasks

#### 5.1 Screen Reader Support

**Files:** `components/*.tsx`

```typescript
// Enhanced ARIA labels and descriptions
const ProductCard = ({ product }: { product: Product }) => {
  return (
    <div
      role="article"
      aria-labelledby={`product-title-${product.id}`}
      aria-describedby={`product-desc-${product.id}`}
    >
      <h3 id={`product-title-${product.id}`}>
        {product.title}
      </h3>
      <p id={`product-desc-${product.id}`}>
        {product.description}
      </p>
      <button
        aria-label={`Save ${product.title} to favorites`}
        onClick={() => handleSave(product.id)}
      >
        <HeartIcon aria-hidden="true" />
      </button>
    </div>
  )
}
```

#### 5.2 Keyboard Navigation

**Files:** `components/GiftForm.tsx`, `components/SwipeDeck.tsx`

```typescript
// Enhanced keyboard navigation
const GiftForm = () => {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        // Navigate to previous option
        break
      case 'ArrowRight':
        e.preventDefault()
        // Navigate to next option
        break
      case 'Enter':
        e.preventDefault()
        // Select current option
        break
      case 'Escape':
        e.preventDefault()
        // Close form or go back
        break
    }
  }

  return (
    <form onKeyDown={handleKeyDown}>
      {/* Form content */}
    </form>
  )
}
```

#### 5.3 Color Contrast Compliance

**Files:** `app/globals.css`, `tailwind.config.js`

```css
/* Ensure WCAG AA compliance */
:root {
  --text-primary: #1f2937; /* 4.5:1 contrast ratio */
  --text-secondary: #6b7280; /* 4.5:1 contrast ratio */
  --background: #ffffff;
  --accent: #8b5cf6; /* 4.5:1 contrast ratio */
}

/* Focus indicators */
.focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

#### 5.4 Focus Management

**Files:** `lib/focus.ts`, `components/*.tsx`

```typescript
// lib/focus.ts
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )

  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[
    focusableElements.length - 1
  ] as HTMLElement

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }
  }

  element.addEventListener('keydown', handleTabKey)
  firstElement.focus()

  return () => element.removeEventListener('keydown', handleTabKey)
}
```

### Success Criteria

- [ ] WCAG 2.1 AA compliance achieved
- [ ] Screen reader testing passes
- [ ] Keyboard navigation works throughout
- [ ] Color contrast ratios meet standards
- [ ] Focus management implemented

### Timeline: 2-3 days

---

## 🎯 6. RECOMMENDATION ENGINE ENHANCEMENT PLAN

### Current State Analysis

- ✅ Basic vector similarity search
- ✅ OpenAI embeddings
- ❌ No user preference learning
- ❌ Limited niche targeting
- ❌ No A/B testing framework

### Implementation Tasks

#### 6.1 User Preference Learning

**Files:** `lib/recs/user-profile.ts`, `prisma/schema.prisma`

```typescript
// lib/recs/user-profile.ts
export class UserProfileLearner {
  async updateProfile(userId: string, interactions: UserInteraction[]) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: { preferences: true },
    })

    // Update preferences based on interactions
    const updatedPreferences = this.calculatePreferences(profile, interactions)

    await prisma.userProfile.upsert({
      where: { userId },
      update: { preferences: updatedPreferences },
      create: { userId, preferences: updatedPreferences },
    })
  }

  private calculatePreferences(profile: any, interactions: UserInteraction[]) {
    // ML-based preference calculation
    return {
      preferredCategories: this.extractCategories(interactions),
      priceRange: this.calculatePriceRange(interactions),
      brandPreferences: this.extractBrands(interactions),
      occasionPreferences: this.extractOccasions(interactions),
    }
  }
}
```

#### 6.2 Niche Targeting

**Files:** `lib/recs/niche-targeting.ts`

```typescript
// lib/recs/niche-targeting.ts
export class NicheTargetingEngine {
  private niches = [
    'tech-enthusiasts',
    'book-lovers',
    'fitness-fanatics',
    'art-collectors',
    'foodies',
    'travelers',
    'gamers',
    'musicians',
  ]

  async identifyNiche(userProfile: UserProfile): Promise<string[]> {
    const scores = await Promise.all(
      this.niches.map((niche) => this.calculateNicheScore(userProfile, niche))
    )

    return this.niches
      .map((niche, index) => ({ niche, score: scores[index] }))
      .filter(({ score }) => score > 0.7)
      .map(({ niche }) => niche)
  }

  private async calculateNicheScore(
    profile: UserProfile,
    niche: string
  ): Promise<number> {
    // Complex scoring algorithm based on user behavior
    return 0.8 // Placeholder
  }
}
```

#### 6.3 A/B Testing Framework

**Files:** `lib/ab-testing.ts`, `app/api/recommend/route.ts`

```typescript
// lib/ab-testing.ts
export class ABTestingFramework {
  async getVariant(userId: string, testName: string): Promise<string> {
    const hash = this.hashUserId(userId + testName)
    return hash % 2 === 0 ? 'A' : 'B'
  }

  async trackConversion(userId: string, testName: string, variant: string) {
    await prisma.abTestResult.create({
      data: {
        userId,
        testName,
        variant,
        converted: true,
        timestamp: new Date(),
      },
    })
  }

  private hashUserId(input: string): number {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}
```

#### 6.4 Advanced Ranking Algorithm

**Files:** `lib/recs/ranking.ts`

```typescript
// lib/recs/ranking.ts
export class AdvancedRankingEngine {
  async rankProducts(
    products: Product[],
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<RankedProduct[]> {
    return products
      .map((product) => ({
        product,
        score: this.calculateScore(product, userProfile, context),
      }))
      .sort((a, b) => b.score - a.score)
  }

  private calculateScore(
    product: Product,
    userProfile: UserProfile,
    context: RecommendationContext
  ): number {
    const factors = {
      relevance: this.calculateRelevance(product, userProfile),
      quality: this.calculateQuality(product),
      popularity: this.calculatePopularity(product),
      recency: this.calculateRecency(product),
      price: this.calculatePriceScore(product, userProfile),
      occasion: this.calculateOccasionScore(product, context),
    }

    return (
      Object.values(factors).reduce((sum, factor) => sum + factor, 0) /
      Object.keys(factors).length
    )
  }
}
```

### Success Criteria

- [ ] User preferences learned from interactions
- [ ] Niche targeting identifies user interests
- [ ] A/B testing framework operational
- [ ] Advanced ranking improves recommendation quality
- [ ] Recommendation accuracy > 80%

### Timeline: 5-6 days

---

## 📊 7. VENDOR EXPERIENCE ENHANCEMENT PLAN

### Current State Analysis

- ✅ Basic vendor dashboard
- ✅ Stripe integration
- ❌ Limited analytics
- ❌ No bulk operations
- ❌ No API access

### Implementation Tasks

#### 7.1 Enhanced Analytics Dashboard

**Files:** `app/vendor/dashboard/page.tsx`, `lib/analytics/vendor.ts`

```typescript
// lib/analytics/vendor.ts
export class VendorAnalytics {
  async getDashboardData(vendorId: string, period: '7d' | '30d' | '90d') {
    const [impressions, clicks, conversions, revenue] = await Promise.all([
      this.getImpressions(vendorId, period),
      this.getClicks(vendorId, period),
      this.getConversions(vendorId, period),
      this.getRevenue(vendorId, period),
    ])

    return {
      impressions,
      clicks,
      conversions,
      revenue,
      ctr: clicks / impressions,
      conversionRate: conversions / clicks,
      revenuePerImpression: revenue / impressions,
    }
  }

  async getProductPerformance(vendorId: string) {
    return prisma.product.findMany({
      where: { vendorId },
      include: {
        _count: {
          select: {
            recommendationEvents: {
              where: { action: 'IMPRESSION' },
            },
          },
        },
      },
      orderBy: {
        recommendationEvents: {
          _count: 'desc',
        },
      },
    })
  }
}
```

#### 7.2 Bulk Operations

**Files:** `app/vendor/bulk/page.tsx`, `lib/vendor/bulk-operations.ts`

```typescript
// lib/vendor/bulk-operations.ts
export class BulkOperations {
  async bulkUpdateProducts(
    vendorId: string,
    updates: BulkProductUpdate[]
  ): Promise<BulkOperationResult> {
    const results = await Promise.allSettled(
      updates.map((update) => this.updateProduct(vendorId, update))
    )

    return {
      successful: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      errors: results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason),
    }
  }

  async bulkImportProducts(
    vendorId: string,
    csvData: string
  ): Promise<BulkImportResult> {
    const products = this.parseCSV(csvData)
    const results = await Promise.allSettled(
      products.map((product) => this.createProduct(vendorId, product))
    )

    return {
      imported: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    }
  }
}
```

#### 7.3 API Access

**Files:** `app/api/vendor/api-key/route.ts`, `lib/vendor/api-client.ts`

```typescript
// lib/vendor/api-client.ts
export class VendorAPIClient {
  constructor(private apiKey: string) {}

  async updateProduct(productId: string, updates: Partial<Product>) {
    const response = await fetch('/api/vendor/products', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, updates }),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  }

  async getAnalytics(period: string) {
    const response = await fetch(`/api/vendor/analytics?period=${period}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    })

    return response.json()
  }
}
```

#### 7.4 Enhanced Onboarding

**Files:** `app/vendor/onboarding/page.tsx`, `lib/vendor/onboarding.ts`

```typescript
// lib/vendor/onboarding.ts
export class VendorOnboarding {
  private steps = [
    'welcome',
    'business-info',
    'payment-setup',
    'first-product',
    'verification',
    'complete',
  ]

  async getCurrentStep(vendorId: string): Promise<string> {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { onboardingStep: true },
    })

    return vendor?.onboardingStep || 'welcome'
  }

  async completeStep(vendorId: string, step: string) {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { onboardingStep: step },
    })
  }

  async getStepProgress(vendorId: string): Promise<OnboardingProgress> {
    const currentStep = await this.getCurrentStep(vendorId)
    const currentIndex = this.steps.indexOf(currentStep)

    return {
      currentStep,
      progress: (currentIndex / this.steps.length) * 100,
      nextStep: this.steps[currentIndex + 1] || null,
      isComplete: currentStep === 'complete',
    }
  }
}
```

### Success Criteria

- [ ] Comprehensive analytics dashboard
- [ ] Bulk operations for product management
- [ ] API access for vendors
- [ ] Streamlined onboarding process
- [ ] Vendor satisfaction score > 4.5/5

### Timeline: 4-5 days

---

## 📝 8. CONTENT MANAGEMENT SYSTEM PLAN

### Current State Analysis

- ✅ Basic gift guides
- ❌ No blog system
- ❌ No SEO content strategy
- ❌ No user-generated content

### Implementation Tasks

#### 8.1 Blog System

**Files:** `app/blog/page.tsx`, `lib/cms/blog.ts`

```typescript
// lib/cms/blog.ts
export class BlogCMS {
  async createPost(post: CreatePostInput): Promise<BlogPost> {
    return prisma.blogPost.create({
      data: {
        ...post,
        slug: this.generateSlug(post.title),
        publishedAt: post.published ? new Date() : null,
      },
    })
  }

  async getPublishedPosts(limit: number = 10): Promise<BlogPost[]> {
    return prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    })
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }
}
```

#### 8.2 SEO Content Strategy

**Files:** `lib/seo/content-strategy.ts`

```typescript
// lib/seo/content-strategy.ts
export class SEOContentStrategy {
  private keywords = [
    'gift ideas',
    'birthday gifts',
    'christmas gifts',
    'anniversary gifts',
    'valentine gifts',
    'graduation gifts',
  ]

  async generateContentIdeas(): Promise<ContentIdea[]> {
    return this.keywords.map((keyword) => ({
      keyword,
      title: `Best ${keyword} for 2024`,
      description: `Discover the perfect ${keyword} with our AI-powered recommendations`,
      targetAudience: this.getTargetAudience(keyword),
      contentType: 'guide',
      estimatedTraffic: this.estimateTraffic(keyword),
    }))
  }

  private getTargetAudience(keyword: string): string[] {
    // AI-powered audience analysis
    return ['gift-givers', 'shoppers', 'holiday-shoppers']
  }
}
```

#### 8.3 User-Generated Content

**Files:** `app/reviews/page.tsx`, `lib/cms/reviews.ts`

```typescript
// lib/cms/reviews.ts
export class ReviewSystem {
  async createReview(review: CreateReviewInput): Promise<ProductReview> {
    return prisma.productReview.create({
      data: {
        ...review,
        status: 'PENDING', // Moderation required
        createdAt: new Date(),
      },
    })
  }

  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return prisma.productReview.findMany({
      where: {
        productId,
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, avatar: true } } },
    })
  }

  async moderateReview(reviewId: string, decision: 'APPROVE' | 'REJECT') {
    await prisma.productReview.update({
      where: { id: reviewId },
      data: { status: decision },
    })
  }
}
```

#### 8.4 Content Automation

**Files:** `lib/cms/automation.ts`

```typescript
// lib/cms/automation.ts
export class ContentAutomation {
  async generateGiftGuide(category: string): Promise<GiftGuide> {
    const products = await prisma.product.findMany({
      where: {
        categories: { has: category },
        status: 'APPROVED',
      },
      take: 20,
      orderBy: { qualityScore: 'desc' },
    })

    const guide = await this.createGuide({
      title: `Best ${category} Gifts for 2024`,
      description: `Discover the top-rated ${category} gifts recommended by our AI`,
      products: products.map((p) => p.id),
      category,
      published: true,
    })

    return guide
  }

  async scheduleContentPublishing() {
    const scheduledPosts = await prisma.blogPost.findMany({
      where: {
        published: false,
        scheduledAt: { lte: new Date() },
      },
    })

    for (const post of scheduledPosts) {
      await this.publishPost(post.id)
    }
  }
}
```

### Success Criteria

- [ ] Blog system operational
- [ ] SEO content strategy implemented
- [ ] User-generated content system
- [ ] Content automation working
- [ ] Organic traffic growth > 50%

### Timeline: 4-5 days

---

## 💰 9. MONETIZATION OPTIMIZATION PLAN

### Current State Analysis

- ✅ Basic affiliate integration
- ✅ Vendor subscription tiers
- ❌ Limited affiliate programs
- ❌ No conversion optimization
- ❌ No pricing strategy testing

### Implementation Tasks

#### 9.1 Affiliate Program Expansion

**Files:** `lib/affiliates/expanded.ts`

```typescript
// lib/affiliates/expanded.ts
export class ExpandedAffiliateProgram {
  private programs = {
    amazon: { id: process.env.AMAZON_ASSOCIATE_ID, rate: 0.04 },
    ebay: { id: process.env.EBAY_PARTNER_ID, rate: 0.02 },
    etsy: { id: process.env.ETSY_AWIN_ID, rate: 0.03 },
    target: { id: process.env.TARGET_PARTNER_ID, rate: 0.02 },
    walmart: { id: process.env.WALMART_PARTNER_ID, rate: 0.02 },
  }

  async generateAffiliateLink(
    product: Product,
    program: keyof typeof this.programs
  ): Promise<string> {
    const config = this.programs[program]

    switch (program) {
      case 'amazon':
        return `https://amazon.com/dp/${product.asin}?tag=${config.id}`
      case 'ebay':
        return `https://ebay.com/itm/${product.sourceItemId}?mkcid=1&mkrid=${config.id}`
      case 'etsy':
        return `https://etsy.com/listing/${product.sourceItemId}?aff=${config.id}`
      default:
        return product.affiliateUrl
    }
  }

  async trackConversion(
    clickId: string,
    program: keyof typeof this.programs,
    revenue: number
  ) {
    await prisma.affiliateConversion.create({
      data: {
        clickId,
        program,
        revenue,
        commission: revenue * this.programs[program].rate,
        createdAt: new Date(),
      },
    })
  }
}
```

#### 9.2 Conversion Optimization

**Files:** `lib/conversion/optimization.ts`

```typescript
// lib/conversion/optimization.ts
export class ConversionOptimization {
  async optimizeCheckoutFlow(vendorId: string): Promise<OptimizationResult> {
    const currentFlow = await this.getCurrentFlow(vendorId)
    const optimizedFlow = await this.generateOptimizedFlow(currentFlow)

    return {
      currentConversionRate: currentFlow.conversionRate,
      optimizedConversionRate: optimizedFlow.conversionRate,
      improvements: optimizedFlow.improvements,
      implementation: optimizedFlow.implementation
    }
  }

  async A/BTestPricing(
    vendorId: string,
    variants: PricingVariant[]
  ): Promise<ABTestResult> {
    const test = await prisma.abTest.create({
      data: {
        name: 'pricing_optimization',
        variants: variants.map(v => ({
          name: v.name,
          price: v.price,
          description: v.description
        })),
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    })

    return test
  }
}
```

#### 9.3 Revenue Analytics

**Files:** `lib/analytics/revenue.ts`

```typescript
// lib/analytics/revenue.ts
export class RevenueAnalytics {
  async getRevenueBreakdown(
    period: '7d' | '30d' | '90d'
  ): Promise<RevenueBreakdown> {
    const [affiliateRevenue, vendorRevenue, totalRevenue] = await Promise.all([
      this.getAffiliateRevenue(period),
      this.getVendorRevenue(period),
      this.getTotalRevenue(period),
    ])

    return {
      affiliate: {
        revenue: affiliateRevenue,
        percentage: (affiliateRevenue / totalRevenue) * 100,
      },
      vendor: {
        revenue: vendorRevenue,
        percentage: (vendorRevenue / totalRevenue) * 100,
      },
      total: totalRevenue,
    }
  }

  async getRevenueProjection(): Promise<RevenueProjection> {
    const historicalData = await this.getHistoricalRevenue(90) // 90 days
    const trend = this.calculateTrend(historicalData)

    return {
      current: historicalData[historicalData.length - 1],
      projected: this.projectRevenue(historicalData, trend),
      growthRate: trend,
      confidence: this.calculateConfidence(historicalData),
    }
  }
}
```

#### 9.4 Dynamic Pricing

**Files:** `lib/pricing/dynamic.ts`

```typescript
// lib/pricing/dynamic.ts
export class DynamicPricing {
  async calculateOptimalPrice(
    product: Product,
    marketConditions: MarketConditions
  ): Promise<number> {
    const factors = {
      demand: await this.calculateDemand(product),
      competition: await this.calculateCompetition(product),
      seasonality: this.calculateSeasonality(product),
      inventory: await this.calculateInventory(product),
    }

    const basePrice = product.price
    const adjustment = this.calculatePriceAdjustment(factors)

    return Math.max(basePrice * (1 + adjustment), basePrice * 0.5) // Min 50% of base price
  }

  private calculatePriceAdjustment(factors: PricingFactors): number {
    // Complex pricing algorithm
    return 0.1 // Placeholder
  }
}
```

### Success Criteria

- [ ] Multiple affiliate programs integrated
- [ ] Conversion rate optimization implemented
- [ ] Revenue analytics dashboard
- [ ] Dynamic pricing system
- [ ] Revenue growth > 100% month-over-month

### Timeline: 5-6 days

---

## 📊 10. ANALYTICS IMPLEMENTATION PLAN

### Current State Analysis

- ✅ Basic Google Analytics
- ❌ No user behavior tracking
- ❌ No conversion funnel analysis
- ❌ No performance monitoring

### Implementation Tasks

#### 10.1 User Behavior Tracking

**Files:** `lib/analytics/behavior.ts`

```typescript
// lib/analytics/behavior.ts
export class BehaviorTracking {
  async trackUserJourney(userId: string, event: UserEvent) {
    await prisma.userJourney.create({
      data: {
        userId,
        eventType: event.type,
        eventData: event.data,
        timestamp: new Date(),
        sessionId: event.sessionId,
      },
    })
  }

  async analyzeUserFlow(): Promise<UserFlowAnalysis> {
    const journeys = await prisma.userJourney.findMany({
      orderBy: { timestamp: 'asc' },
    })

    return {
      entryPoints: this.analyzeEntryPoints(journeys),
      dropOffPoints: this.analyzeDropOffs(journeys),
      conversionPaths: this.analyzeConversionPaths(journeys),
      averageSessionDuration: this.calculateAverageSessionDuration(journeys),
    }
  }
}
```

#### 10.2 Conversion Funnel Analysis

**Files:** `lib/analytics/funnel.ts`

```typescript
// lib/analytics/funnel.ts
export class ConversionFunnel {
  private funnelSteps = [
    'landing',
    'form_start',
    'form_complete',
    'recommendations_view',
    'product_click',
    'purchase',
  ]

  async analyzeFunnel(period: '7d' | '30d' | '90d'): Promise<FunnelAnalysis> {
    const data = await this.getFunnelData(period)

    return {
      steps: this.funnelSteps.map((step, index) => ({
        step,
        users: data[step],
        conversionRate:
          index > 0 ? data[step] / data[this.funnelSteps[index - 1]] : 1,
        dropOffRate:
          index > 0 ? 1 - data[step] / data[this.funnelSteps[index - 1]] : 0,
      })),
      overallConversionRate: data.purchase / data.landing,
      optimizationOpportunities: this.identifyOptimizationOpportunities(data),
    }
  }
}
```

#### 10.3 Performance Monitoring

**Files:** `lib/analytics/performance.ts`

```typescript
// lib/analytics/performance.ts
export class PerformanceMonitoring {
  async trackCoreWebVitals(metrics: CoreWebVitalsMetrics) {
    await prisma.performanceMetrics.create({
      data: {
        lcp: metrics.lcp,
        fid: metrics.fid,
        cls: metrics.cls,
        fcp: metrics.fcp,
        ttfb: metrics.ttfb,
        timestamp: new Date(),
      },
    })
  }

  async getPerformanceReport(): Promise<PerformanceReport> {
    const metrics = await prisma.performanceMetrics.findMany({
      orderBy: { timestamp: 'desc' },
      take: 1000,
    })

    return {
      averageLCP: this.calculateAverage(metrics.map((m) => m.lcp)),
      averageFID: this.calculateAverage(metrics.map((m) => m.fid)),
      averageCLS: this.calculateAverage(metrics.map((m) => m.cls)),
      performanceScore: this.calculatePerformanceScore(metrics),
      trends: this.calculateTrends(metrics),
    }
  }
}
```

#### 10.4 Real-time Analytics Dashboard

**Files:** `app/admin/analytics/page.tsx`

```typescript
// Real-time analytics dashboard
const AnalyticsDashboard = () => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await fetch('/api/admin/analytics/realtime').then(r => r.json())
      setMetrics(data)
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard title="Active Users" value={metrics?.activeUsers} />
      <MetricCard title="Page Views" value={metrics?.pageViews} />
      <MetricCard title="Conversion Rate" value={metrics?.conversionRate} />
      <MetricCard title="Revenue" value={metrics?.revenue} />
    </div>
  )
}
```

### Success Criteria

- [ ] User behavior tracking implemented
- [ ] Conversion funnel analysis working
- [ ] Performance monitoring active
- [ ] Real-time analytics dashboard
- [ ] Data-driven optimization decisions

### Timeline: 3-4 days

---

## 🗄️ 11. DATABASE OPTIMIZATION PLAN

### Current State Analysis

- ✅ PostgreSQL with pgvector
- ✅ Basic indexing
- ❌ No connection pooling
- ❌ Limited query optimization
- ❌ No performance monitoring

### Implementation Tasks

#### 11.1 Connection Pooling

**Files:** `lib/database/pool.ts`

```typescript
// lib/database/pool.ts
import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
})

export async function withConnection<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    return await callback(client)
  } finally {
    client.release()
  }
}
```

#### 11.2 Query Optimization

**Files:** `lib/database/optimization.ts`

```typescript
// lib/database/optimization.ts
export class QueryOptimizer {
  async optimizeProductQueries(): Promise<OptimizationResult> {
    const slowQueries = await this.identifySlowQueries()
    const optimizations = await Promise.all(
      slowQueries.map((query) => this.optimizeQuery(query))
    )

    return {
      optimizedQueries: optimizations.length,
      averageImprovement: this.calculateAverageImprovement(optimizations),
      recommendations: this.generateRecommendations(optimizations),
    }
  }

  private async identifySlowQueries(): Promise<SlowQuery[]> {
    // Query pg_stat_statements for slow queries
    return [] // Placeholder
  }
}
```

#### 11.3 Database Monitoring

**Files:** `lib/database/monitoring.ts`

```typescript
// lib/database/monitoring.ts
export class DatabaseMonitoring {
  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const [connections, queries, performance] = await Promise.all([
      this.getConnectionStats(),
      this.getQueryStats(),
      this.getPerformanceStats(),
    ])

    return {
      connections,
      queries,
      performance,
      healthScore: this.calculateHealthScore(connections, queries, performance),
    }
  }

  async monitorQueryPerformance(): Promise<QueryPerformanceReport> {
    const queries = await this.getTopSlowQueries()

    return {
      slowestQueries: queries,
      averageQueryTime: this.calculateAverageQueryTime(queries),
      optimizationOpportunities:
        this.identifyOptimizationOpportunities(queries),
    }
  }
}
```

#### 11.4 Index Optimization

**Files:** `sql/optimize-indexes.sql`

```sql
-- Optimize indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_status_quality
ON "Product" (status, "qualityScore" DESC)
WHERE status = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_categories_gin
ON "Product" USING GIN (categories);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_embedding_cosine
ON "Product" USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendation_events_session
ON "RecommendationEvent" (session_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_swipes_user_id
ON "Swipe" (user_id, created_at);
```

### Success Criteria

- [ ] Connection pooling implemented
- [ ] Query performance optimized
- [ ] Database monitoring active
- [ ] Indexes optimized for common queries
- [ ] Database response time < 100ms

### Timeline: 2-3 days

---

## 🎯 IMPLEMENTATION PRIORITY MATRIX

### Week 1: Foundation (Critical)

1. **SEO Optimization** (2-3 days)
2. **Performance Optimization** (3-4 days)
3. **Security Hardening** (2-3 days)

### Week 2: User Experience (High)

4. **Mobile Optimization** (3-4 days)
5. **Accessibility Compliance** (2-3 days)
6. **Error Handling** (2-3 days)

### Week 3: Business Features (Medium)

7. **Recommendation Engine** (5-6 days)
8. **Vendor Experience** (4-5 days)
9. **Content Management** (4-5 days)

### Week 4: Launch Prep (High)

10. **Monetization Optimization** (5-6 days)
11. **Analytics Implementation** (3-4 days)
12. **Database Optimization** (2-3 days)

## 📈 SUCCESS METRICS

### Technical Metrics

- **Performance**: Lighthouse Score > 90
- **SEO**: Search Console coverage > 95%
- **Security**: Zero critical vulnerabilities
- **Accessibility**: WCAG 2.1 AA compliance
- **Database**: Query response time < 100ms

### Business Metrics

- **User Experience**: Conversion rate improvement > 25%
- **Revenue**: Growth > 100% month-over-month
- **Vendor Satisfaction**: Score > 4.5/5
- **User Engagement**: Session duration increase > 30%
- **Organic Traffic**: Growth > 50%

## 🚀 NEXT STEPS

1. **Choose Priority**: Which area should we tackle first?
2. **Resource Allocation**: Assign team members to each area
3. **Timeline Confirmation**: Adjust timelines based on team capacity
4. **Implementation**: Begin with highest priority items
5. **Monitoring**: Track progress against success metrics

**Recommendation**: Start with SEO and Performance optimization as they provide immediate user acquisition and retention benefits.
