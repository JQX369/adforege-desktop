/**
 * Smart Product Seeding Script
 * 
 * Strategy: Use FREE or low-cost methods to bootstrap catalog
 * 1. Manual CSV curation (high quality, zero cost)
 * 2. Apify actors for allowed sources (Etsy, smaller retailers)
 * 3. Public APIs where available (eBay Browse API is free)
 * 
 * Cost: $0-49/mo depending on scale needs
 * 
 * Usage:
 *   ts-node scripts/smart-seed-products.ts --method=csv --file=./data/seed.csv
 *   ts-node scripts/smart-seed-products.ts --method=ebay --keywords="gifts,tech,personalized"
 *   ts-node scripts/smart-seed-products.ts --method=apify --source=etsy
 */

import { PrismaClient, ProductSource, AvailabilityStatus, ProductStatus } from '@prisma/client'
import OpenAI from 'openai'
import { buildAffiliateUrl, cleanProductUrl } from '@/lib/affiliates'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

// Gift categories optimized for recommendation quality
const GIFT_KEYWORDS = [
  // High-intent gift categories
  'personalized gifts',
  'unique gifts for her',
  'unique gifts for him',
  'tech gadgets gifts',
  'handmade gifts',
  'luxury gifts',
  'funny gifts',
  'romantic gifts',
  'gifts for mom',
  'gifts for dad',
  'gifts for teens',
  'gifts for kids',
  'birthday gifts',
  'anniversary gifts',
  'christmas gifts',
  
  // Specific product types
  'jewelry gifts',
  'home decor gifts',
  'kitchen gadgets',
  'books gifts',
  'subscription boxes',
  'experience gifts',
  'spa gifts',
  'fitness gifts',
  'gaming gifts',
  'art supplies gifts',
]

interface ProductData {
  title: string
  description: string
  price: number
  imageUrl: string
  url: string
  categories: string[]
  brand?: string
  retailer?: string
  currency?: string
  asin?: string
  merchantDomain?: string
  affiliateProgram?: string
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 1500),
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('Embedding generation failed:', error)
    return []
  }
}

function calculateQualityScore(product: ProductData, embedding: number[]): number {
  let score = 0
  
  // Price exists and reasonable
  if (product.price > 0 && product.price < 10000) score += 0.25
  
  // Has image
  if (product.imageUrl && product.imageUrl.length > 10) score += 0.25
  
  // Has valid URL with affiliate potential
  if (product.url && product.url.startsWith('http')) score += 0.25
  
  // Has embedding for semantic search
  if (embedding.length > 0) score += 0.25
  
  return score
}

async function upsertProduct(product: ProductData): Promise<{ created: boolean; productId: string }> {
  const cleaned = cleanProductUrl(product.url)
  const affiliateUrl = buildAffiliateUrl(cleaned)
  const embedding = await generateEmbedding(`${product.title} ${product.description}`)
  const qualityScore = calculateQualityScore(product, embedding)
  const status = qualityScore >= 0.75 ? ProductStatus.APPROVED : ProductStatus.PENDING
  
  // Get or create merchant
  let merchantId: string | null = null
  if (product.merchantDomain) {
    const domain = product.merchantDomain.replace(/^www\./, '')
    let merchant = await prisma.merchant.findUnique({ where: { domain } })
    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          name: product.retailer || domain,
          domain,
          affiliateProgram: product.affiliateProgram || null,
        }
      })
    }
    merchantId = merchant.id
  }
  
  // Check if product exists
  const existing = await prisma.product.findFirst({
    where: {
      OR: [
        { urlCanonical: cleaned },
        ...(product.asin ? [{ asin: product.asin }] : []),
      ]
    }
  })
  
  const data = {
    title: product.title,
    description: product.description,
    price: product.price,
    images: product.imageUrl ? [product.imageUrl] : [],
    affiliateUrl,
    categories: product.categories,
    embedding,
    status,
    source: ProductSource.CURATED,
    retailer: product.retailer || null,
    currency: product.currency || 'USD',
    availability: AvailabilityStatus.UNKNOWN,
    brand: product.brand || null,
    asin: product.asin || null,
    merchantId,
    affiliateProgram: product.affiliateProgram || null,
    urlCanonical: cleaned,
    qualityScore,
    lastSeenAt: new Date(),
    rating: null as number | null,
    numReviews: null as number | null,
  }
  
  if (existing) {
    await prisma.product.update({ where: { id: existing.id }, data })
    return { created: false, productId: existing.id }
  } else {
    const created = await prisma.product.create({ data })
    return { created: true, productId: created.id }
  }
}

// METHOD 1: Manual CSV Import (FREE, highest quality)
async function seedFromCSV(filePath: string) {
  console.log(`📄 Reading CSV from ${filePath}...`)
  
  const text = fs.readFileSync(path.resolve(filePath), 'utf8')
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as Array<Record<string, string>>
  
  console.log(`Found ${rows.length} products to process`)
  
  let created = 0
  let updated = 0
  let errors = 0
  
  for (const row of rows) {
    try {
      const product: ProductData = {
        title: String(row.title ?? ''),
        description: row.description ? String(row.description) : '',
        price: parseFloat(String(row.price ?? '0')) || 0,
        imageUrl: String(row.imageUrl ?? ''),
        url: String(row.url ?? ''),
        categories: (row.categories || '')
          .toString()
          .split('|')
          .map((s: string) => s.trim())
          .filter(Boolean),
        brand: row.brand ? String(row.brand) : undefined,
        retailer: row.retailer ? String(row.retailer) : undefined,
        currency: row.currency ? String(row.currency) : 'USD',
        asin: row.asin ? String(row.asin) : undefined,
        merchantDomain: row.merchantDomain ? String(row.merchantDomain) : undefined,
        affiliateProgram: row.affiliateProgram ? String(row.affiliateProgram) : undefined,
      }
      
      const result = await upsertProduct(product)
      if (result.created) {
        created++
        console.log(`  ✅ Created: ${product.title.slice(0, 50)}...`)
      } else {
        updated++
        console.log(`  🔄 Updated: ${product.title.slice(0, 50)}...`)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      errors++
      console.error(`  ❌ Error processing row:`, error)
    }
  }
  
  console.log(`\n📊 Results: ${created} created, ${updated} updated, ${errors} errors`)
  return { created, updated, errors }
}

// METHOD 2: eBay Browse API (FREE with approved app)
async function seedFromEbay(keywords: string[]) {
  console.log(`🔍 Fetching from eBay for ${keywords.length} keywords...`)
  
  const { syncEbayByKeyword } = await import('@/lib/providers/ebay')
  
  let totalCreated = 0
  let totalUpdated = 0
  
  for (const keyword of keywords) {
    try {
      console.log(`\n  Processing: "${keyword}"`)
      const result = await syncEbayByKeyword(keyword)
      totalCreated += result.created
      totalUpdated += result.updated
      console.log(`  ✅ ${result.created} created, ${result.updated} updated`)
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`  ❌ Error for "${keyword}":`, error)
    }
  }
  
  console.log(`\n📊 Total: ${totalCreated} created, ${totalUpdated} updated`)
  return { created: totalCreated, updated: totalUpdated }
}

// METHOD 3: Apify Actors (for allowed sources like Etsy)
async function seedFromApify(source: 'etsy' | 'uncommongoods' | 'notonthehighstreet') {
  console.log(`🕷️  Using Apify for ${source}...`)
  
  // Note: This requires APIFY_TOKEN env variable
  const apifyToken = process.env.APIFY_TOKEN
  if (!apifyToken) {
    console.error('❌ APIFY_TOKEN not found in environment variables')
    console.log('Sign up at https://apify.com and get your API token')
    return { created: 0, updated: 0 }
  }
  
  // Example: Etsy scraper
  if (source === 'etsy') {
    console.log('📍 Scraping Etsy popular gift listings...')
    
    // Use Apify's Etsy scraper actor
    const actorId = 'curious_coder/etsy-scraper' // Popular Etsy scraper
    const runInput = {
      searchQuery: 'unique gifts',
      maxItems: 100,
      proxyConfiguration: { useApifyProxy: true },
    }
    
    try {
      const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: runInput }),
      })
      
      if (!response.ok) {
        throw new Error(`Apify API error: ${response.status}`)
      }
      
      const run = await response.json()
      const runId = run.data.id
      
      console.log(`  ⏳ Waiting for scraper to complete (run: ${runId})...`)
      
      // Poll for completion
      let attempts = 0
      let dataset: any = null
      
      while (attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
        
        const statusResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apifyToken}`)
        const statusData = await statusResponse.json()
        
        if (statusData.data.status === 'SUCCEEDED') {
          const datasetId = statusData.data.defaultDatasetId
          const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`)
          dataset = await datasetResponse.json()
          break
        } else if (statusData.data.status === 'FAILED') {
          throw new Error('Apify actor run failed')
        }
        
        attempts++
        console.log(`  ⏳ Still running... (${attempts * 10}s)`)
      }
      
      if (!dataset) {
        throw new Error('Scraper timed out')
      }
      
      console.log(`  ✅ Scraped ${dataset.length} products`)
      
      // Process results
      let created = 0
      let updated = 0
      
      for (const item of dataset) {
        try {
          const product: ProductData = {
            title: item.title || item.name || '',
            description: item.description || '',
            price: parseFloat(item.price?.replace(/[^0-9.]/g, '') || '0'),
            imageUrl: item.image || item.imageUrl || '',
            url: item.url || item.link || '',
            categories: item.categories || ['Handmade', 'Etsy'],
            retailer: 'Etsy',
            currency: 'USD',
            merchantDomain: 'etsy.com',
            affiliateProgram: 'etsy',
          }
          
          if (!product.title || !product.url) continue
          
          const result = await upsertProduct(product)
          if (result.created) created++
          else updated++
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error('  ❌ Error processing item:', error)
        }
      }
      
      console.log(`\n📊 Results: ${created} created, ${updated} updated`)
      return { created, updated }
    } catch (error) {
      console.error('❌ Apify scraping failed:', error)
      return { created: 0, updated: 0 }
    }
  }
  
  return { created: 0, updated: 0 }
}

// MAIN EXECUTION
async function main() {
  const args = process.argv.slice(2)
  const methodArg = args.find(a => a.startsWith('--method='))
  const fileArg = args.find(a => a.startsWith('--file='))
  const keywordsArg = args.find(a => a.startsWith('--keywords='))
  const sourceArg = args.find(a => a.startsWith('--source='))
  
  const method = methodArg?.split('=')[1] || 'csv'
  
  console.log('🚀 Smart Product Seeding Script')
  console.log('================================\n')
  
  try {
    if (method === 'csv') {
      const filePath = fileArg?.split('=')[1] || './data/seed-products.csv'
      await seedFromCSV(filePath)
    } else if (method === 'ebay') {
      const keywordsStr = keywordsArg?.split('=')[1] || GIFT_KEYWORDS.slice(0, 5).join(',')
      const keywords = keywordsStr.split(',').map(k => k.trim())
      await seedFromEbay(keywords)
    } else if (method === 'apify') {
      const source = sourceArg?.split('=')[1] as any || 'etsy'
      await seedFromApify(source)
    } else if (method === 'all') {
      console.log('🎯 Running full seed pipeline...\n')
      
      // Step 1: CSV if exists
      const csvPath = './data/seed-products.csv'
      if (fs.existsSync(csvPath)) {
        console.log('Step 1: CSV Import')
        await seedFromCSV(csvPath)
      }
      
      // Step 2: eBay (free)
      if (process.env.EBAY_APP_ID) {
        console.log('\nStep 2: eBay Import')
        await seedFromEbay(GIFT_KEYWORDS.slice(0, 10))
      }
      
      // Step 3: Apify (if token available)
      if (process.env.APIFY_TOKEN) {
        console.log('\nStep 3: Apify Import')
        await seedFromApify('etsy')
      }
      
      console.log('\n✅ Full pipeline complete!')
    } else {
      console.error(`Unknown method: ${method}`)
      console.log('\nUsage:')
      console.log('  ts-node scripts/smart-seed-products.ts --method=csv --file=./data/seed.csv')
      console.log('  ts-node scripts/smart-seed-products.ts --method=ebay --keywords="gifts,tech"')
      console.log('  ts-node scripts/smart-seed-products.ts --method=apify --source=etsy')
      console.log('  ts-node scripts/smart-seed-products.ts --method=all')
      process.exit(1)
    }
    
    // Show final stats
    const total = await prisma.product.count()
    const approved = await prisma.product.count({ where: { status: 'APPROVED' } })
    
    console.log('\n📈 Database Stats:')
    console.log(`  Total products: ${total}`)
    console.log(`  Approved: ${approved}`)
    console.log(`  Quality: ${((approved / total) * 100).toFixed(1)}%`)
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

