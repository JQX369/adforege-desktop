import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EbayProvider } from '@/src/lib/clients/ebay-enhanced'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface HealthCheck {
  ok: boolean
  timestamp: number
  checks: {
    database: { ok: boolean; error?: string }
    openai: { ok: boolean; error?: string }
    ebay: { ok: boolean; tokenAge?: number; error?: string }
    environment: { ok: boolean; missing?: string[] }
  }
}

export async function GET(): Promise<NextResponse<HealthCheck>> {
  const timestamp = Date.now()
  const checks: HealthCheck['checks'] = {
    database: { ok: false },
    openai: { ok: false },
    ebay: { ok: false },
    environment: { ok: false },
  }

  // Check environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'EBAY_CLIENT_ID',
    'EBAY_CLIENT_SECRET',
    'RAINFOREST_API_KEY',
  ]
  const missingEnvVars = requiredEnvVars.filter(
    (key) => !process.env[key] || process.env[key]!.length < 10
  )

  if (missingEnvVars.length === 0) {
    checks.environment.ok = true
  } else {
    checks.environment.missing = missingEnvVars
  }

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database.ok = true
  } catch (error) {
    checks.database.error =
      error instanceof Error ? error.message : 'Unknown error'
  }

  // Check OpenAI API
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      await openai.models.list()
      checks.openai.ok = true
    } catch (error) {
      checks.openai.error =
        error instanceof Error ? error.message : 'Unknown error'
    }
  } else {
    checks.openai.error = 'OPENAI_API_KEY not set'
  }

  // Check eBay token status
  if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) {
    try {
      const ebayProvider = new EbayProvider({
        clientId: process.env.EBAY_CLIENT_ID,
        clientSecret: process.env.EBAY_CLIENT_SECRET,
        timeout: 10000,
      })

      const token = await ebayProvider.getAppToken()
      if (token) {
        checks.ebay.ok = true
        // Calculate token age (approximate)
        checks.ebay.tokenAge =
          Date.now() -
          (token.expiresAt ? new Date(token.expiresAt).getTime() : Date.now())
      } else {
        checks.ebay.error = 'Failed to obtain token'
      }
    } catch (error) {
      checks.ebay.error =
        error instanceof Error ? error.message : 'Unknown error'
    }
  } else {
    checks.ebay.error = 'EBAY credentials not set'
  }

  const allOk = Object.values(checks).every((check) => check.ok)

  return NextResponse.json({
    ok: allOk,
    timestamp,
    checks,
  })
}
