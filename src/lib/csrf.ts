import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac, timingSafeEqual } from 'crypto'

// CSRF token configuration
const CSRF_SECRET =
  process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'
const CSRF_TOKEN_LENGTH = 32
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000 // 1 hour

interface CsrfToken {
  token: string
  expiresAt: number
}

// Generate a secure CSRF token
export function generateCsrfToken(): string {
  const randomToken = randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
  const timestamp = Date.now().toString()
  const data = `${randomToken}:${timestamp}`

  const hmac = createHmac('sha256', CSRF_SECRET)
  hmac.update(data)
  const signature = hmac.digest('hex')

  return `${data}:${signature}`
}

// Validate a CSRF token
export function validateCsrfToken(token: string): boolean {
  try {
    const parts = token.split(':')
    if (parts.length !== 3) return false

    const [randomToken, timestamp, signature] = parts

    // Check if token is expired
    const tokenTime = parseInt(timestamp, 10)
    if (Date.now() - tokenTime > CSRF_TOKEN_EXPIRY) {
      return false
    }

    // Verify signature
    const data = `${randomToken}:${timestamp}`
    const hmac = createHmac('sha256', CSRF_SECRET)
    hmac.update(data)
    const expectedSignature = hmac.digest('hex')

    // Use timing-safe comparison
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

// Extract CSRF token from request
export function extractCsrfToken(req: NextRequest): string | null {
  // Try to get token from header first
  const headerToken = req.headers.get('x-csrf-token')
  if (headerToken) return headerToken

  // Try to get token from form data
  const formData = req.formData?.()
  if (formData) {
    const token = formData.get('_csrf') as string
    if (token) return token
  }

  // Try to get token from JSON body
  try {
    const body = req.json?.()
    if (body) {
      const token = body._csrf
      if (token) return token
    }
  } catch {
    // Ignore JSON parsing errors
  }

  return null
}

// CSRF middleware for API routes
export function withCsrfProtection(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Skip CSRF protection for GET requests
    if (req.method === 'GET') {
      return handler(req)
    }

    // Skip CSRF protection for public endpoints
    const url = new URL(req.url)
    const publicEndpoints = ['/api/health', '/api/sitemap', '/api/robots']
    if (publicEndpoints.some((endpoint) => url.pathname.startsWith(endpoint))) {
      return handler(req)
    }

    const token = extractCsrfToken(req)

    if (!token || !validateCsrfToken(token)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }

    return handler(req)
  }
}

// CSRF token endpoint
export async function GET(): Promise<NextResponse> {
  const token = generateCsrfToken()

  return NextResponse.json(
    { csrfToken: token },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )
}

// CSRF token for forms
export function getCsrfTokenForForm(): string {
  return generateCsrfToken()
}

// CSRF token validation for forms
export function validateFormCsrfToken(
  formToken: string,
  sessionToken: string
): boolean {
  return validateCsrfToken(formToken) && validateCsrfToken(sessionToken)
}

// CSRF protection for Next.js forms
export function createCsrfProtectedForm(
  action: string,
  method: string = 'POST'
): { action: string; method: string; csrfToken: string } {
  const token = generateCsrfToken()

  return {
    action,
    method,
    csrfToken: token,
  }
}

// CSRF token refresh
export function refreshCsrfToken(oldToken: string): string | null {
  if (!validateCsrfToken(oldToken)) {
    return null
  }

  return generateCsrfToken()
}

// CSRF token expiry check
export function isCsrfTokenExpired(token: string): boolean {
  try {
    const parts = token.split(':')
    if (parts.length !== 3) return true

    const timestamp = parseInt(parts[1], 10)
    return Date.now() - timestamp > CSRF_TOKEN_EXPIRY
  } catch {
    return true
  }
}

// CSRF token cleanup (for server-side cleanup)
export function cleanupExpiredTokens(): void {
  // This would typically be implemented with a database
  // For now, we rely on the client-side expiry check
  console.log('CSRF token cleanup - implement with database if needed')
}
