#!/usr/bin/env tsx

/**
 * Automatic Ingestion System
 * Runs periodic ingestion to keep products up-to-date
 */

import { config } from 'dotenv'
import { prisma } from '@/lib/prisma'
import { syncRainforestByKeyword } from '@/lib/providers/rainforest-enhanced'
import { syncEbayByKeyword } from '@/lib/providers/ebay-enhanced'

// Load environment variables
config({ path: '.env.local' })

interface IngestionConfig {
  keywords: string[]
  providers: ('rainforest' | 'ebay')[]
  limit: number
  intervalMinutes: number
}

const DEFAULT_CONFIG: IngestionConfig = {
  keywords: [
    'tech gifts',
    'wireless headphones',
    'smart home',
    'gaming accessories',
    'kitchen gadgets',
    'fitness equipment',
    'beauty products',
    'home decor',
    'books',
    'toys',
  ],
  providers: ['rainforest', 'ebay'],
  limit: 10,
  intervalMinutes: 60, // Run every hour
}

class AutoIngestionSystem {
  private config: IngestionConfig
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  constructor(config: IngestionConfig = DEFAULT_CONFIG) {
    this.config = config
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Auto-ingestion already running')
      return
    }

    console.log('🚀 Starting auto-ingestion system...')
    console.log(`📋 Keywords: ${this.config.keywords.join(', ')}`)
    console.log(`🔄 Providers: ${this.config.providers.join(', ')}`)
    console.log(`⏰ Interval: ${this.config.intervalMinutes} minutes`)
    console.log(`📊 Limit per keyword: ${this.config.limit} products`)

    this.isRunning = true

    // Run immediately
    await this.runIngestion()

    // Schedule periodic runs
    this.intervalId = setInterval(async () => {
      await this.runIngestion()
    }, this.config.intervalMinutes * 60 * 1000)

    console.log('✅ Auto-ingestion system started')
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Auto-ingestion not running')
      return
    }

    console.log('🛑 Stopping auto-ingestion system...')
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    console.log('✅ Auto-ingestion system stopped')
  }

  private async runIngestion(): Promise<void> {
    const startTime = Date.now()
    console.log(`\n🔄 Starting ingestion cycle at ${new Date().toISOString()}`)

    let totalCreated = 0
    let totalUpdated = 0
    let totalErrors = 0
    const errors: string[] = []

    for (const keyword of this.config.keywords) {
      console.log(`\n📝 Processing keyword: "${keyword}"`)

      for (const provider of this.config.providers) {
        try {
          console.log(`  🔍 ${provider}...`)
          
          let result
          if (provider === 'rainforest') {
            result = await syncRainforestByKeyword(keyword, {
              limit: this.config.limit,
              country: 'GB',
            })
          } else if (provider === 'ebay') {
            result = await syncEbayByKeyword(keyword, {
              limit: this.config.limit,
              country: 'GB',
            })
          } else {
            throw new Error(`Unknown provider: ${provider}`)
          }

          if (result.success) {
            totalCreated += result.created
            totalUpdated += result.updated
            console.log(`    ✅ ${result.created} created, ${result.updated} updated`)
          } else {
            totalErrors += result.errors
            errors.push(...result.errorMessages)
            console.log(`    ❌ ${result.errors} errors: ${result.errorMessages.join(', ')}`)
          }

          // Small delay between providers to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000))

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          totalErrors++
          errors.push(`${provider}: ${errorMsg}`)
          console.log(`    ❌ Error: ${errorMsg}`)
        }
      }

      // Delay between keywords to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    const duration = Date.now() - startTime
    console.log(`\n📊 Ingestion cycle completed in ${duration}ms`)
    console.log(`   ✅ Created: ${totalCreated}`)
    console.log(`   🔄 Updated: ${totalUpdated}`)
    console.log(`   ❌ Errors: ${totalErrors}`)

    if (errors.length > 0) {
      console.log(`   🚨 Error details: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}`)
    }

    // Log to database for monitoring
    await this.logIngestionRun({
      duration,
      created: totalCreated,
      updated: totalUpdated,
      errors: totalErrors,
      errorMessages: errors,
    })
  }

  private async logIngestionRun(data: {
    duration: number
    created: number
    updated: number
    errors: number
    errorMessages: string[]
  }): Promise<void> {
    try {
      await prisma.ingestionLog.create({
        data: {
          durationMs: data.duration,
          productsCreated: data.created,
          productsUpdated: data.updated,
          errors: data.errors,
          errorMessages: data.errorMessages.length > 0 ? data.errorMessages : null,
        },
      })
      console.log('📝 Ingestion run logged to database')
    } catch (error) {
      console.warn('Failed to log ingestion run:', error)
    }
  }

  async getStatus(): Promise<{
    isRunning: boolean
    nextRun?: Date
    config: IngestionConfig
  }> {
    return {
      isRunning: this.isRunning,
      nextRun: this.isRunning && this.intervalId 
        ? new Date(Date.now() + this.config.intervalMinutes * 60 * 1000)
        : undefined,
      config: this.config,
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2]
  const system = new AutoIngestionSystem()

  switch (command) {
    case 'start':
      await system.start()
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, stopping...')
        await system.stop()
        process.exit(0)
      })
      process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, stopping...')
        await system.stop()
        process.exit(0)
      })
      break

    case 'stop':
      await system.stop()
      break

    case 'status':
      const status = await system.getStatus()
      console.log('📊 Auto-ingestion status:')
      console.log(`   Running: ${status.isRunning}`)
      if (status.nextRun) {
        console.log(`   Next run: ${status.nextRun.toISOString()}`)
      }
      console.log(`   Keywords: ${status.config.keywords.length}`)
      console.log(`   Providers: ${status.config.providers.join(', ')}`)
      console.log(`   Interval: ${status.config.intervalMinutes} minutes`)
      break

    case 'run-once':
      console.log('🔄 Running single ingestion cycle...')
      await system['runIngestion']()
      break

    default:
      console.log('Usage: tsx scripts/auto-ingest.ts <command>')
      console.log('Commands:')
      console.log('  start     - Start the auto-ingestion system')
      console.log('  stop      - Stop the auto-ingestion system')
      console.log('  status    - Show current status')
      console.log('  run-once  - Run a single ingestion cycle')
      process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Auto-ingestion failed:', error)
    process.exit(1)
  })
}

export { AutoIngestionSystem }
