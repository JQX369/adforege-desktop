#!/usr/bin/env ts-node
/**
 * Main Ingestion Script - Rainforest + eBay
 * 
 * Usage:
 *   ts-node scripts/ingest-from-apis.ts --provider=rainforest --keywords="tech gifts,jewelry"
 *   ts-node scripts/ingest-from-apis.ts --provider=ebay --keywords="unique gifts"
 *   ts-node scripts/ingest-from-apis.ts --provider=all --limit=50
 */

import { RainforestProvider } from '@/lib/providers/rainforest-enhanced'
import { EbayProvider } from '@/lib/providers/ebay-enhanced'
import { IngestionEngine } from '@/lib/providers/ingestion-engine'
import { BaseProduct } from '@/lib/providers/types'

// Gift-focused keywords for best results
const DEFAULT_KEYWORDS = [
  // High-intent gift searches
  'personalized gifts',
  'unique gifts for her',
  'unique gifts for him',
  'tech gadgets gifts',
  'handmade gifts',
  'luxury gifts',
  'romantic gifts anniversary',
  'gifts for mom birthday',
  'gifts for dad',
  'gifts for teens',
  
  // Specific categories
  'jewelry gifts women',
  'home decor gifts',
  'kitchen gadgets gifts',
  'book gifts readers',
  'subscription box gifts',
  'spa gifts relaxation',
  'fitness gifts',
  'gaming gifts',
  'art supplies gifts',
  'gourmet food gifts',
]

interface IngestionConfig {
  provider: 'rainforest' | 'ebay' | 'all'
  keywords?: string[]
  limit?: number
  dryRun?: boolean
}

async function main() {
  console.log('🚀 Starting API Ingestion System\n')
  console.log('='.repeat(60))
  
  // Parse command line arguments
  const args = process.argv.slice(2)
  const config: IngestionConfig = {
    provider: 'all',
    keywords: DEFAULT_KEYWORDS,
    limit: 20,
    dryRun: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--provider=')) {
      config.provider = arg.split('=')[1] as any
    } else if (arg.startsWith('--keywords=')) {
      config.keywords = arg.split('=')[1].split(',').map(k => k.trim())
    } else if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.split('=')[1])
    } else if (arg === '--dry-run') {
      config.dryRun = true
    }
  }

  console.log('📋 Configuration:')
  console.log(`  Provider: ${config.provider}`)
  console.log(`  Keywords: ${config.keywords?.length} keywords`)
  console.log(`  Limit per keyword: ${config.limit}`)
  console.log(`  Dry run: ${config.dryRun}`)
  console.log('='.repeat(60) + '\n')

  // Initialize providers
  const rainforestKey = process.env.RAINFOREST_API_KEY
  const ebayAppId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID
  const ebayToken = process.env.EBAY_OAUTH_TOKEN
  const ebayCampaignId = process.env.EBAY_CAMPAIGN_ID

  let rainforest: RainforestProvider | null = null
  let ebay: EbayProvider | null = null

  if (config.provider === 'rainforest' || config.provider === 'all') {
    if (!rainforestKey) {
      console.error('❌ RAINFOREST_API_KEY not found in environment')
      console.log('   Sign up at: https://www.rainforestapi.com/')
      process.exit(1)
    }
    rainforest = new RainforestProvider(rainforestKey)
    console.log('✅ Rainforest API initialized')
  }

  if (config.provider === 'ebay' || config.provider === 'all') {
    if (!ebayAppId || !ebayToken) {
      console.error('❌ eBay credentials not found in environment')
      console.log('   Need: EBAY_APP_ID and EBAY_OAUTH_TOKEN')
      console.log('   Sign up at: https://developer.ebay.com/')
      process.exit(1)
    }
    ebay = new EbayProvider(ebayAppId, ebayToken, ebayCampaignId)
    console.log('✅ eBay API initialized')
  }

  const engine = new IngestionEngine()
  
  // Statistics
  const stats = {
    totalProducts: 0,
    rainforestProducts: 0,
    ebayProducts: 0,
    created: 0,
    updated: 0,
    errors: 0,
    startTime: Date.now(),
  }

  try {
    for (const keyword of config.keywords!) {
      console.log(`\n${'─'.repeat(60)}`)
      console.log(`🔍 Processing keyword: "${keyword}"`)
      console.log('─'.repeat(60))

      let products: BaseProduct[] = []

      // Fetch from Rainforest
      if (rainforest) {
        try {
          console.log('  📡 Fetching from Rainforest (Amazon)...')
          const amazonProducts = await rainforest.searchByKeyword(keyword, config.limit)
          products = products.concat(amazonProducts)
          stats.rainforestProducts += amazonProducts.length
          console.log(`  ✅ Found ${amazonProducts.length} products from Amazon`)
        } catch (error) {
          console.error(`  ❌ Rainforest error:`, error)
          stats.errors++
        }
      }

      // Fetch from eBay
      if (ebay) {
        try {
          console.log('  📡 Fetching from eBay...')
          const ebayProducts = await ebay.searchByKeyword(keyword, config.limit)
          products = products.concat(ebayProducts)
          stats.ebayProducts += ebayProducts.length
          console.log(`  ✅ Found ${ebayProducts.length} products from eBay`)
        } catch (error) {
          console.error(`  ❌ eBay error:`, error)
          stats.errors++
        }
      }

      stats.totalProducts += products.length

      // Ingest products
      if (products.length > 0 && !config.dryRun) {
        console.log(`  💾 Ingesting ${products.length} products into database...`)
        const result = await engine.ingestProducts(products)
        
        stats.created += result.created
        stats.updated += result.updated
        stats.errors += result.errors

        console.log(`  📊 Results:`)
        console.log(`     ✨ Created: ${result.created}`)
        console.log(`     🔄 Updated: ${result.updated}`)
        console.log(`     ⚠️  Errors: ${result.errors}`)
        console.log(`     ⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`)

        if (result.errorMessages.length > 0) {
          console.log(`\n  ⚠️  Error details:`)
          result.errorMessages.slice(0, 3).forEach(msg => {
            console.log(`     • ${msg}`)
          })
          if (result.errorMessages.length > 3) {
            console.log(`     ... and ${result.errorMessages.length - 3} more`)
          }
        }
      } else if (config.dryRun) {
        console.log(`  🏃 Dry run - would ingest ${products.length} products`)
      }

      // Small delay between keywords
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Final statistics
    console.log('\n' + '='.repeat(60))
    console.log('🎉 Ingestion Complete!')
    console.log('='.repeat(60))
    console.log(`\n📊 Final Statistics:`)
    console.log(`  Total products found: ${stats.totalProducts}`)
    console.log(`  ├─ Rainforest (Amazon): ${stats.rainforestProducts}`)
    console.log(`  └─ eBay: ${stats.ebayProducts}`)
    console.log(`\n  💾 Database operations:`)
    console.log(`  ├─ Created: ${stats.created}`)
    console.log(`  ├─ Updated: ${stats.updated}`)
    console.log(`  └─ Errors: ${stats.errors}`)
    console.log(`\n  ⏱️  Total duration: ${((Date.now() - stats.startTime) / 1000 / 60).toFixed(1)} minutes`)

    // Show database stats
    const dbStats = await engine.getStats()
    console.log(`\n📈 Database Status:`)
    console.log(`  Total products: ${dbStats.total}`)
    console.log(`  ├─ Approved: ${dbStats.approved} (${((dbStats.approved / dbStats.total) * 100).toFixed(1)}%)`)
    console.log(`  ├─ Pending: ${dbStats.pending}`)
    console.log(`  └─ Rejected: ${dbStats.rejected}`)
    console.log(`\n  Quality metrics:`)
    console.log(`  ├─ Average quality score: ${dbStats.avgQuality.toFixed(2)}`)
    console.log(`  ├─ With images: ${dbStats.dataCompleteness.withImages.toFixed(1)}%`)
    console.log(`  ├─ With shipping: ${dbStats.dataCompleteness.withShipping.toFixed(1)}%`)
    console.log(`  ├─ With delivery: ${dbStats.dataCompleteness.withDelivery.toFixed(1)}%`)
    console.log(`  └─ In stock: ${dbStats.dataCompleteness.inStock.toFixed(1)}%`)

    // Show provider stats
    if (rainforest) {
      const rfStats = rainforest.getStats()
      console.log(`\n🌧️  Rainforest API Stats:`)
      console.log(`  Total requests: ${rfStats.totalRequests}`)
      console.log(`  Success rate: ${((rfStats.successfulRequests / rfStats.totalRequests) * 100).toFixed(1)}%`)
      console.log(`  Avg response time: ${rfStats.averageResponseTime.toFixed(0)}ms`)
    }

    if (ebay) {
      const ebayStats = ebay.getStats()
      console.log(`\n🛒 eBay API Stats:`)
      console.log(`  Total requests: ${ebayStats.totalRequests}`)
      console.log(`  Success rate: ${((ebayStats.successfulRequests / ebayStats.totalRequests) * 100).toFixed(1)}%`)
      console.log(`  Avg response time: ${ebayStats.averageResponseTime.toFixed(0)}ms`)
    }

    console.log('\n✅ All done! Your catalog is ready.\n')

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await engine.disconnect()
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { main }

