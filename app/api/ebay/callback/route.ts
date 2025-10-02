import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

// NOTE: Update this handler, related environment variables, and the registered redirect URI whenever the primary domain changes.
// eBay requires the callback URL (RuName) to match exactly, including protocol and path.

const CALLBACK_ENDPOINT = process.env.EBAY_CALLBACK_URL || 'https://presentgogo.vercel.app/api/ebay/callback'
const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN || ''

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const challengeCode = url.searchParams.get('challenge_code')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expiresIn = url.searchParams.get('expires_in')

  // Handle marketplace account deletion verification handshake
  if (challengeCode) {
    if (!VERIFICATION_TOKEN) {
      console.error('[eBay OAuth] Missing EBAY_VERIFICATION_TOKEN env var. Cannot respond to challenge.')
      return NextResponse.json(
        { error: 'Missing verification token' },
        { status: 500 }
      )
    }

    const hash = createHash('sha256')
    hash.update(challengeCode)
    hash.update(VERIFICATION_TOKEN)
    hash.update(CALLBACK_ENDPOINT)
    const challengeResponse = hash.digest('hex')

    console.log('[eBay OAuth] Responding to challenge_code', {
      timestamp: new Date().toISOString(),
      challengeCodePresent: Boolean(challengeCode),
    })

    return NextResponse.json({ challengeResponse })
  }

  console.log('[eBay OAuth] Callback received', {
    timestamp: new Date().toISOString(),
    codePresent: Boolean(code),
    state,
    expiresIn,
  })

  return NextResponse.json({
    success: true,
    message: 'eBay OAuth callback received. Complete the token exchange on the server.',
  })
}
