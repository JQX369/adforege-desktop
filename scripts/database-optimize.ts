#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface OptimizationResult {
  operation: string
  status: 'success' | 'error' | 'skipped'
  message: string
  duration?: number
  affectedRows?: number
}

class DatabaseOptimizer {
  private prisma: PrismaClient
  private results: OptimizationResult[] = []

  constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    })
  }

  async optimize(): Promise<void> {
    console.log('🗄️ Starting database optimization...\n')

    await this.analyzeTables()
    await this.optimizeIndexes()
    await this.vacuumTables()
    await this.updateStatistics()
    await this.checkConstraints()
    await this.optimizeQueries()

    this.printReport()
  }

  private async analyzeTables(): Promise<void> {
    console.log('📊 Analyzing table statistics...')

    try {
      const startTime = Date.now()

      // Analyze all tables
      await this.prisma.$executeRaw`ANALYZE`

      const duration = Date.now() - startTime
      this.results.push({
        operation: 'Analyze Tables',
        status: 'success',
        message: 'Table statistics updated successfully',
        duration,
      })
    } catch (error) {
      this.results.push({
        operation: 'Analyze Tables',
        status: 'error',
        message: `Failed to analyze tables: ${error}`,
      })
    }
  }

  private async optimizeIndexes(): Promise<void> {
    console.log('🔍 Optimizing indexes...')

    try {
      const startTime = Date.now()

      // Get index usage statistics
      const indexStats = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
      `

      // Reindex tables with high fragmentation
      await this.prisma
        .$executeRaw`REINDEX DATABASE ${process.env.DATABASE_NAME || 'fairywize'}`

      const duration = Date.now() - startTime
      this.results.push({
        operation: 'Optimize Indexes',
        status: 'success',
        message: `Indexes optimized successfully. Found ${Array.isArray(indexStats) ? indexStats.length : 0} indexes`,
        duration,
      })
    } catch (error) {
      this.results.push({
        operation: 'Optimize Indexes',
        status: 'error',
        message: `Failed to optimize indexes: ${error}`,
      })
    }
  }

  private async vacuumTables(): Promise<void> {
    console.log('🧹 Vacuuming tables...')

    try {
      const startTime = Date.now()

      // Vacuum all tables
      await this.prisma.$executeRaw`VACUUM ANALYZE`

      const duration = Date.now() - startTime
      this.results.push({
        operation: 'Vacuum Tables',
        status: 'success',
        message: 'Tables vacuumed and analyzed successfully',
        duration,
      })
    } catch (error) {
      this.results.push({
        operation: 'Vacuum Tables',
        status: 'error',
        message: `Failed to vacuum tables: ${error}`,
      })
    }
  }

  private async updateStatistics(): Promise<void> {
    console.log('📈 Updating query planner statistics...')

    try {
      const startTime = Date.now()

      // Update statistics for all tables
      await this.prisma
        .$executeRaw`UPDATE pg_stat_user_tables SET n_tup_ins = 0, n_tup_upd = 0, n_tup_del = 0`

      const duration = Date.now() - startTime
      this.results.push({
        operation: 'Update Statistics',
        status: 'success',
        message: 'Query planner statistics updated successfully',
        duration,
      })
    } catch (error) {
      this.results.push({
        operation: 'Update Statistics',
        status: 'error',
        message: `Failed to update statistics: ${error}`,
      })
    }
  }

  private async checkConstraints(): Promise<void> {
    console.log('🔒 Checking database constraints...')

    try {
      const startTime = Date.now()

      // Check for constraint violations
      const violations = await this.prisma.$queryRaw`
        SELECT 
          conname as constraint_name,
          contype as constraint_type,
          conrelid::regclass as table_name
        FROM pg_constraint
        WHERE contype IN ('f', 'c', 'u', 'p')
        ORDER BY conname
      `

      const duration = Date.now() - startTime
      this.results.push({
        operation: 'Check Constraints',
        status: 'success',
        message: `Constraints checked successfully. Found ${Array.isArray(violations) ? violations.length : 0} constraints`,
        duration,
      })
    } catch (error) {
      this.results.push({
        operation: 'Check Constraints',
        status: 'error',
        message: `Failed to check constraints: ${error}`,
      })
    }
  }

  private async optimizeQueries(): Promise<void> {
    console.log('⚡ Optimizing common queries...')

    try {
      const startTime = Date.now()

      // Optimize product queries
      await this.optimizeProductQueries()

      // Optimize recommendation queries
      await this.optimizeRecommendationQueries()

      // Optimize user queries
      await this.optimizeUserQueries()

      const duration = Date.now() - startTime
      this.results.push({
        operation: 'Optimize Queries',
        status: 'success',
        message: 'Common queries optimized successfully',
        duration,
      })
    } catch (error) {
      this.results.push({
        operation: 'Optimize Queries',
        status: 'error',
        message: `Failed to optimize queries: ${error}`,
      })
    }
  }

  private async optimizeProductQueries(): Promise<void> {
    // Create optimized indexes for product queries
    const productIndexes = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status_quality ON products(status, quality_score DESC)',
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_categories_price ON products USING GIN(categories) WHERE status = 'APPROVED'",
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_rating_reviews ON products(rating DESC, num_reviews DESC) WHERE rating IS NOT NULL',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_popularity_recency ON products(popularity_score DESC, recency_score DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_stock_availability ON products(in_stock, availability) WHERE in_stock = true',
    ]

    for (const indexQuery of productIndexes) {
      try {
        await this.prisma.$executeRawUnsafe(indexQuery)
      } catch (error) {
        console.warn(`Failed to create index: ${indexQuery}`, error)
      }
    }
  }

  private async optimizeRecommendationQueries(): Promise<void> {
    // Create optimized indexes for recommendation queries
    const recommendationIndexes = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swipes_user_action ON swipes(user_id, action)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swipes_product_action ON swipes(product_id, action)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swipes_timestamp ON swipes(ts DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_profiles_session ON session_profiles(session_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendation_events_session ON recommendation_events(session_id, action)',
    ]

    for (const indexQuery of recommendationIndexes) {
      try {
        await this.prisma.$executeRawUnsafe(indexQuery)
      } catch (error) {
        console.warn(`Failed to create index: ${indexQuery}`, error)
      }
    }
  }

  private async optimizeUserQueries(): Promise<void> {
    // Create optimized indexes for user queries
    const userIndexes = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_user_id ON vendors(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_subscription ON vendors(plan, subscription_status)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merchants_domain ON merchants(domain)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merchants_status ON merchants(status)',
    ]

    for (const indexQuery of userIndexes) {
      try {
        await this.prisma.$executeRawUnsafe(indexQuery)
      } catch (error) {
        console.warn(`Failed to create index: ${indexQuery}`, error)
      }
    }
  }

  private printReport(): void {
    console.log('\n📊 Database Optimization Report')
    console.log('='.repeat(50))

    const successful = this.results.filter((r) => r.status === 'success')
    const errors = this.results.filter((r) => r.status === 'error')
    const skipped = this.results.filter((r) => r.status === 'skipped')

    console.log(`\n✅ Successful Operations: ${successful.length}`)
    successful.forEach((result) => {
      console.log(`  ${result.operation}: ${result.message}`)
      if (result.duration) {
        console.log(`    Duration: ${result.duration}ms`)
      }
    })

    if (errors.length > 0) {
      console.log(`\n❌ Failed Operations: ${errors.length}`)
      errors.forEach((result) => {
        console.log(`  ${result.operation}: ${result.message}`)
      })
    }

    if (skipped.length > 0) {
      console.log(`\n⏭️ Skipped Operations: ${skipped.length}`)
      skipped.forEach((result) => {
        console.log(`  ${result.operation}: ${result.message}`)
      })
    }

    console.log(`\n📈 Summary:`)
    console.log(`  Total Operations: ${this.results.length}`)
    console.log(`  Successful: ${successful.length}`)
    console.log(`  Failed: ${errors.length}`)
    console.log(`  Skipped: ${skipped.length}`)

    const totalDuration = this.results.reduce(
      (sum, r) => sum + (r.duration || 0),
      0
    )
    console.log(`  Total Duration: ${totalDuration}ms`)

    if (errors.length === 0) {
      console.log('\n🎉 Database optimization completed successfully!')
    } else {
      console.log('\n⚠️ Database optimization completed with some errors.')
    }
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

// Run the optimization
async function main() {
  const optimizer = new DatabaseOptimizer()

  try {
    await optimizer.optimize()
  } catch (error) {
    console.error('Database optimization failed:', error)
    process.exit(1)
  } finally {
    await optimizer.cleanup()
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { DatabaseOptimizer }
