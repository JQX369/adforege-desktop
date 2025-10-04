import { NextRequest, NextResponse } from 'next/server'
import { getCurrencyFromCountry } from '@/lib/prices'

// Currency detection middleware
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Protect /dev route for admin users only
  if (pathname.startsWith('/dev')) {
    const hasSession = request.cookies.has('sb-access-token') || request.cookies.has('sb.access-token')
    if (!hasSession) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }


  // Get currency from various sources
  let detectedCurrency = 'USD' // Default fallback

  // 1. Check for existing currency cookie
  const currencyCookie = request.cookies.get('preferred-currency')
  if (currencyCookie?.value) {
    detectedCurrency = currencyCookie.value
  } else {
    // 2. Check Accept-Language header for regional preference
    const acceptLanguage = request.headers.get('accept-language')
    if (acceptLanguage) {
      // Extract country from language tag (e.g., "en-GB" -> "GB")
      const languageTags = acceptLanguage.split(',').map(tag => tag.trim().split(';')[0])
      for (const tag of languageTags) {
        const countryCode = tag.split('-')[1]?.toUpperCase()
        if (countryCode) {
          const currency = getCurrencyFromCountry(countryCode)
          if (currency !== 'USD') {
            detectedCurrency = currency
            break
          }
        }
      }
    }

    // 3. Check Cloudflare geo headers (if available)
    const countryCode = request.headers.get('cf-ipcountry') ||
                       request.headers.get('x-vercel-ip-country') ||
                       request.headers.get('x-country-code')

    if (countryCode) {
      const geoCurrency = getCurrencyFromCountry(countryCode)
      if (geoCurrency !== 'USD') {
        detectedCurrency = geoCurrency
      }
    }
  }

  // Set currency cookie if not already set or different
  const response = NextResponse.next()

  if (!currencyCookie || currencyCookie.value !== detectedCurrency) {
    response.cookies.set('preferred-currency', detectedCurrency, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
  }

  // Add currency header for server components
  response.headers.set('x-detected-currency', detectedCurrency)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
