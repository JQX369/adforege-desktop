import { NextRequest, NextResponse } from 'next/server'

// Security headers configuration
const securityHeaders = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // XSS protection
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',

  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.openai.com https://www.google-analytics.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; '),

  // Strict Transport Security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Cross-Origin policies
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
}

// Clean up expired rate limit entries
setInterval(
  () => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  },
  5 * 60 * 1000
) // Clean up every 5 minutes

// Rate limiting function
function checkRateLimit(req: NextRequest): boolean {
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  const key = `rate_limit:${ip}`
  const now = Date.now()
  const windowMs = rateLimitConfig.windowMs
  const maxRequests = rateLimitConfig.maxRequests

  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

// Helper: detect currency from headers (UK-first)
function detectCurrency(req: NextRequest): 'GBP' | 'EUR' | 'USD' {
  // Cookie takes precedence (handled outside)
  const cf = (req.headers.get('cf-ipcountry') || '').toUpperCase()
  const vercel = (req.headers.get('x-vercel-ip-country') || '').toUpperCase()
  const acceptLang = (req.headers.get('accept-language') || '').toLowerCase()

  // UK-first mapping
  if (cf === 'GB' || vercel === 'GB' || acceptLang.includes('en-gb'))
    return 'GBP'

  // Basic EU list → EUR
  const eu = new Set([
    'AT',
    'BE',
    'CY',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PT',
    'SK',
    'SI',
    'ES',
  ])
  if (
    eu.has(cf) ||
    eu.has(vercel) ||
    /(de|fr|es|it|nl|fi|pt|ie)-[a-z]{2}/.test(acceptLang)
  )
    return 'EUR'

  // US fallback
  if (cf === 'US' || vercel === 'US' || acceptLang.includes('en-us'))
    return 'USD'

  return 'USD'
}

// Security middleware
export function middleware(req: NextRequest): NextResponse {
  const response = NextResponse.next()

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value as string)
  })

  // Rate limiting for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    if (!checkRateLimit(req)) {
      return new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '900', // 15 minutes
          },
        }
      )
    }
  }

  // Block suspicious requests
  const userAgent = req.headers.get('user-agent') || ''
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zap/i,
    /burp/i,
    /w3af/i,
    /acunetix/i,
    /nessus/i,
    /openvas/i,
  ]

  if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Block requests with suspicious query parameters
  const url = req.nextUrl
  const suspiciousParams = [
    'union',
    'select',
    'insert',
    'update',
    'delete',
    'drop',
    'create',
    'alter',
    'script',
    'javascript',
    'vbscript',
    'onload',
    'onerror',
    'onclick',
    '../',
    '..\\',
    'cmd',
    'exec',
    'system',
    'eval',
    'expression',
  ]

  if (url && url.searchParams) {
    for (const [key, value] of url.searchParams.entries()) {
      const paramValue = (value || '').toLowerCase()
      if (suspiciousParams.some((param) => paramValue.includes(param))) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }
  }

  // Block requests with suspicious paths
  const suspiciousPaths = [
    '/admin',
    '/wp-admin',
    '/phpmyadmin',
    '/.env',
    '/config',
    '/backup',
    '/.git',
    '/.svn',
    '/.htaccess',
    '/.htpasswd',
    '/web.config',
  ]

  if (
    suspiciousPaths.some((path) => url.pathname.toLowerCase().includes(path))
  ) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Currency cookie/header handling (only for non-static routes)
  if (
    !req.nextUrl.pathname.startsWith('/_next') &&
    !req.nextUrl.pathname.endsWith('.ico')
  ) {
    const existing = req.cookies.get('preferred-currency')?.value
    const detected = detectCurrency(req)

    response.headers.set('x-detected-currency', detected)

    if (!existing) {
      response.cookies.set('preferred-currency', detected, {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
  }

  // Add CORS headers for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin')
    const allowedOrigins = [
      'http://localhost:3000',
      'https://fairywize.com',
      'https://www.fairywize.com',
    ]

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      )
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-CSRF-Token'
      )
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200 })
  }

  return response
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
