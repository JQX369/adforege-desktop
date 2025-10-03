/*
  Usage:
    ts-node scripts/ingest-curated.ts ./data/seed-products.csv http://localhost:3000

  CSV columns (header required):
    title,description,price,imageUrl,url,categories,brand,retailer,currency,asin,merchantDomain,affiliateProgram
*/
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

function toNumber(v: string) {
  const n = Number(String(v || '').replace(/[^0-9.]/g, ''))
  return isFinite(n) ? n : 0
}

async function main() {
  const csvPath = process.argv[2]
  const origin = process.argv[3] || 'http://localhost:3000'
  if (!csvPath) {
    console.error('Missing CSV path')
    process.exit(1)
  }
  const text = fs.readFileSync(path.resolve(csvPath), 'utf8')
  const rows = parse(text, { columns: true, skip_empty_lines: true })
  const items = rows.map((r: any) => ({
    title: r.title,
    description: r.description,
    price: toNumber(r.price),
    imageUrl: r.imageUrl,
    url: r.url,
    categories: (r.categories || '').split('|').map((s: string) => s.trim()).filter(Boolean),
    brand: r.brand || undefined,
    retailer: r.retailer || undefined,
    currency: r.currency || undefined,
    asin: r.asin || undefined,
    merchantDomain: r.merchantDomain || undefined,
    affiliateProgram: r.affiliateProgram || undefined,
  }))

  const resp = await fetch(`${origin}/api/admin/ingest/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  const json = await resp.json()
  if (!resp.ok) {
    console.error('Ingest failed:', json)
    process.exit(1)
  }
  console.log('Ingest result:', json)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})



