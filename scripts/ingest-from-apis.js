#!/usr/bin/env node
/**
 * Main Ingestion Script - Rainforest + eBay
 * 
 * Usage:
 *   node scripts/ingest-from-apis.js --provider=rainforest --keywords="tech gifts,jewelry"
 *   node scripts/ingest-from-apis.js --provider=ebay --keywords="unique gifts"
 *   node scripts/ingest-from-apis.js --provider=all --limit=50
 */

const { syncRainforestByKeyword } = require('../lib/providers/rainforest-enhanced')
const { syncEbayByKeyword } = require('../lib/providers/ebay-enhanced')
const { IngestionEngine } = require('../lib/providers/ingestion-engine')

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

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    provider: 'all',
    keywords: DEFAULT_KEYWORDS,
    limit: 20,
    dryRun: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg.startsWith('--provider=')) {
      config.provider = arg.split('=')[1]
    } else if (arg.startsWith('--keywords=')) {
      config.keywords = arg.split('=')[1].split(',').map(k => k.trim())
    } else if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.split('=')[1])
    } else if (arg === '--dry-run') {
      config.dryRun = true
    }
  }

  return config
}

async function main() {
  console.log('🚀 Starting API Ingestion System\n')
  
  const config = parseArgs()
  
  console.log('📋 Configuration:')
  console.log(`   Provider: ${config.provider}`)
  console.log(`   Keywords: ${config.keywords.length} selected`)
  console.log(`   Limit per keyword: ${config.limit}`)
  console.log(`   Dry run: ${config.dryRun ? 'YES' : 'NO'}`)
  console.log('')

  const stats = {
    totalProducts: 0,
    created: 0,
    updated: 0,
    errors: 0,
    rainforestProducts: 0,
    ebayProducts: 0,
    errorMessages: []
  }

  const rainforest = config.provider === 'rainforest' || config.provider === 'all'
  const ebay = config.provider === 'ebay' || config.provider === 'all'

  console.log('🔍 Keywords to process:')
  config.keywords.forEach((keyword, index) => {
    console.log(`   ${index + 1}. "${keyword}"`)
  })
  console.log('')

  for (const keyword of config.keywords) {
    console.log(`\n🎯 Processing keyword: "${keyword}"`)
    console.log('=' .repeat(50))
    
    let products = []

    // Fetch from Rainforest
    if (rainforest) {
      try {
        console.log('  📡 Fetching from Rainforest (Amazon)...')
        const result = await syncRainforestByKeyword(keyword, { limit: config.limit || 20 })
        const rainforestProducts = result.products || []
        products = products.concat(rainforestProducts)
        stats.rainforestProducts += rainforestProducts.length
        console.log(`  ✅ Found ${rainforestProducts.length} products from Rainforest`)
      } catch (error) {
        console.error(`  ❌ Rainforest error:`, error.message)
        stats.errors++
      }
    }

    // Fetch from eBay
    if (ebay) {
      try {
        console.log('  📡 Fetching from eBay...')
        const result = await syncEbayByKeyword(keyword, { limit: config.limit || 20 })
        const ebayProducts = result.products || []
        products = products.concat(ebayProducts)
        stats.ebayProducts += ebayProducts.length
        console.log(`  ✅ Found ${ebayProducts.length} products from eBay`)
      } catch (error) {
        console.error(`  ❌ eBay error:`, error.message)
        stats.errors++
      }
    }

    stats.totalProducts += products.length

    // Ingest products
    if (products.length > 0 && !config.dryRun) {
      console.log(`  💾 Ingesting ${products.length} products into database...`)
      const engine = new IngestionEngine()
      try {
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
      } finally {
        await engine.disconnect()
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
  console.log(`   Total products found: ${stats.totalProducts}`)
  console.log(`   Rainforest products: ${stats.rainforestProducts}`)
  console.log(`   eBay products: ${stats.ebayProducts}`)
  console.log(`   Created: ${stats.created}`)
  console.log(`   Updated: ${stats.updated}`)
  console.log(`   Errors: ${stats.errors}`)
  
  if (stats.errors > 0) {
    console.log(`\n⚠️  ${stats.errors} errors occurred during ingestion`)
    process.exit(1)
  } else {
    console.log(`\n✅ All products ingested successfully!`)
    process.exit(0)
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
