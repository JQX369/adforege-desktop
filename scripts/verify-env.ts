import { config } from 'dotenv'
import { resolve } from 'path'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'

// Load env from .env.local when running locally
config({ path: resolve(process.cwd(), '.env.local') })

type Check = {
  name: string
  ok: boolean
  detail?: string
}

async function checkOpenAI(): Promise<Check> {
  const key = process.env.OPENAI_API_KEY || ''
  if (!key || key.length < 40 || !key.startsWith('sk-')) {
    return { name: 'openai.env', ok: false, detail: 'OPENAI_API_KEY missing or malformed' }
  }
  try {
    const client = new OpenAI({ apiKey: key })
    const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: 'ok' })
    if (!res.data?.[0]?.embedding?.length) {
      return { name: 'openai.embed', ok: false, detail: 'Empty embedding returned' }
    }
    return { name: 'openai.embed', ok: true, detail: `dim=${res.data[0].embedding.length}` }
  } catch (err: any) {
    return { name: 'openai.embed', ok: false, detail: err?.message || String(err) }
  }
}

async function checkDatabase(): Promise<Check> {
  const url = process.env.DATABASE_URL || ''
  if (!url.startsWith('postgres')) {
    return { name: 'db.env', ok: false, detail: 'DATABASE_URL missing/invalid' }
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { name: 'db.ping', ok: true }
  } catch (err: any) {
    return { name: 'db.ping', ok: false, detail: err?.message || String(err) }
  } finally {
    await prisma.$disconnect()
  }
}

function checkSupabase(): Check[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return [
    { name: 'supabase.url', ok: !!url, detail: url ? 'present' : 'missing' },
    { name: 'supabase.anon', ok: !!anon && anon.length > 50, detail: anon ? `len=${anon.length}` : 'missing' },
  ]
}

function checkEbay(): Check[] {
  const id = process.env.EBAY_CLIENT_ID
  const secret = process.env.EBAY_CLIENT_SECRET
  return [
    { name: 'ebay.client_id', ok: !!id, detail: id ? 'present' : 'missing' },
    { name: 'ebay.client_secret', ok: !!secret, detail: secret ? 'present' : 'missing' },
  ]
}

function checkRainforest(): Check {
  const key = process.env.RAINFOREST_API_KEY
  return { name: 'rainforest.key', ok: !!key, detail: key ? 'present' : 'missing' }
}

async function main() {
  const results: Check[] = []
  results.push(rainforest())

  function rainforest(): Check { return checkRainforest() }

  results.push(...checkSupabase(), ...checkEbay())
  results.push(await checkDatabase())
  results.push(await checkOpenAI())

  const ok = results.every(r => r.ok)
  console.log('Env/Service Verification Results:')
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` - ${r.detail}` : ''}`)
  }
  if (!ok) process.exitCode = 1
}

main().catch((e) => {
  console.error('verify-env failed:', e)
  process.exitCode = 1
})


