import { PrismaClient } from '@prisma/client'

// Database connection configuration
const DATABASE_CONFIG = {
  // Connection pool settings
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
  minConnections: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5'),
  connectionTimeout: parseInt(
    process.env.DATABASE_CONNECTION_TIMEOUT || '10000'
  ),
  idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),

  // Query settings
  queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '30000'),
  slowQueryThreshold: parseInt(
    process.env.DATABASE_SLOW_QUERY_THRESHOLD || '1000'
  ),

  // Retry settings
  maxRetries: parseInt(process.env.DATABASE_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.DATABASE_RETRY_DELAY || '1000'),
}

// Global Prisma client instance
let prisma: PrismaClient | null = null

// Database connection manager
class DatabaseManager {
  private static instance: DatabaseManager
  private connectionCount = 0
  private activeQueries = new Map<
    string,
    { startTime: number; query: string }
  >()
  private slowQueries: Array<{
    query: string
    duration: number
    timestamp: Date
  }> = []
  private connectionErrors: Array<{ error: string; timestamp: Date }> = []

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  // Get or create Prisma client with connection pooling
  getClient(): PrismaClient {
    if (!prisma) {
      prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'info', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ],
      })

      // Set up query logging and monitoring
      this.setupQueryMonitoring(prisma)
    }

    return prisma
  }

  // Set up query monitoring and logging
  private setupQueryMonitoring(client: PrismaClient): void {
    // Guard for environments/types where $on typing excludes 'query'
    ;(client as any).$on?.('query', (e: any) => {
      const queryId = `${Date.now()}-${Math.random()}`
      this.activeQueries.set(queryId, {
        startTime: Date.now(),
        query: e.query,
      })

      // Check for slow queries
      setTimeout(() => {
        const query = this.activeQueries.get(queryId)
        if (query) {
          const duration = Date.now() - query.startTime
          if (duration > DATABASE_CONFIG.slowQueryThreshold) {
            this.slowQueries.push({
              query: e.query,
              duration,
              timestamp: new Date(),
            })

            // Keep only last 100 slow queries
            if (this.slowQueries.length > 100) {
              this.slowQueries = this.slowQueries.slice(-100)
            }
          }
          this.activeQueries.delete(queryId)
        }
      }, DATABASE_CONFIG.slowQueryThreshold)
    })
    ;(client as any).$on?.('error', (e: any) => {
      this.connectionErrors.push({
        error: e.message,
        timestamp: new Date(),
      })

      // Keep only last 50 errors
      if (this.connectionErrors.length > 50) {
        this.connectionErrors = this.connectionErrors.slice(-50)
      }
    })
  }

  // Execute query with retry logic
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= DATABASE_CONFIG.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt === DATABASE_CONFIG.maxRetries) {
          break
        }

        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(resolve, DATABASE_CONFIG.retryDelay * attempt)
        )
      }
    }

    throw new Error(
      `Database operation '${operationName}' failed after ${DATABASE_CONFIG.maxRetries} attempts: ${lastError?.message}`
    )
  }

  // Get database health status
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    connectionCount: number
    activeQueries: number
    slowQueries: number
    recentErrors: number
    responseTime: number
  }> {
    const startTime = Date.now()

    try {
      // Test database connection
      await this.getClient().$queryRaw`SELECT 1`

      const responseTime = Date.now() - startTime
      const recentErrors = this.connectionErrors.filter(
        (error) => Date.now() - error.timestamp.getTime() < 60000 // Last minute
      ).length

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

      if (responseTime > 1000 || recentErrors > 5) {
        status = 'degraded'
      }

      if (responseTime > 5000 || recentErrors > 20) {
        status = 'unhealthy'
      }

      return {
        status,
        connectionCount: this.connectionCount,
        activeQueries: this.activeQueries.size,
        slowQueries: this.slowQueries.length,
        recentErrors,
        responseTime,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        connectionCount: this.connectionCount,
        activeQueries: this.activeQueries.size,
        slowQueries: this.slowQueries.length,
        recentErrors: this.connectionErrors.length,
        responseTime: Date.now() - startTime,
      }
    }
  }

  // Get slow queries report
  getSlowQueriesReport(): Array<{
    query: string
    duration: number
    timestamp: Date
  }> {
    return [...this.slowQueries].sort((a, b) => b.duration - a.duration)
  }

  // Get connection errors report
  getConnectionErrorsReport(): Array<{ error: string; timestamp: Date }> {
    return [...this.connectionErrors].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    )
  }

  // Clean up resources
  async cleanup(): Promise<void> {
    if (prisma) {
      await prisma.$disconnect()
      prisma = null
    }
  }

  // Get database statistics
  getStatistics(): {
    totalQueries: number
    averageQueryTime: number
    slowestQuery: { query: string; duration: number } | null
    errorRate: number
  } {
    const totalQueries = this.slowQueries.length
    const averageQueryTime =
      totalQueries > 0
        ? this.slowQueries.reduce((sum, q) => sum + q.duration, 0) /
          totalQueries
        : 0

    const slowestQuery =
      this.slowQueries.length > 0
        ? this.slowQueries.reduce((slowest, current) =>
            current.duration > slowest.duration ? current : slowest
          )
        : null

    const errorRate = this.connectionErrors.length / Math.max(totalQueries, 1)

    return {
      totalQueries,
      averageQueryTime,
      slowestQuery,
      errorRate,
    }
  }
}

// Export singleton instance
export const dbManager = DatabaseManager.getInstance()

// Export Prisma client with connection management
// Export optimized Prisma client
export { prisma }

// Export utility functions
export const db = {
  // Execute with retry
  executeWithRetry: <T>(operation: () => Promise<T>, operationName: string) =>
    dbManager.executeWithRetry(operation, operationName),

  // Health check
  getHealthStatus: () => dbManager.getHealthStatus(),

  // Reports
  getSlowQueriesReport: () => dbManager.getSlowQueriesReport(),
  getConnectionErrorsReport: () => dbManager.getConnectionErrorsReport(),

  // Statistics
  getStatistics: () => dbManager.getStatistics(),

  // Cleanup
  cleanup: () => dbManager.cleanup(),
}

// Database query optimization utilities
export class QueryOptimizer {
  // Optimize product queries
  static optimizeProductQuery(filters: {
    categories?: string[]
    priceRange?: { min: number; max: number }
    rating?: number
    inStock?: boolean
    limit?: number
    offset?: number
  }) {
    const {
      categories,
      priceRange,
      rating,
      inStock,
      limit = 20,
      offset = 0,
    } = filters

    if (!prisma) throw new Error('Prisma client not initialized')
    return (prisma as PrismaClient).product.findMany({
      where: {
        ...(categories && { categories: { hasSome: categories } }),
        ...(priceRange && {
          price: {
            gte: priceRange.min,
            lte: priceRange.max,
          },
        }),
        ...(rating && { rating: { gte: rating } }),
        ...(inStock !== undefined && { inStock }),
        status: 'APPROVED',
      },
      orderBy: [
        { qualityScore: 'desc' },
        { popularityScore: 'desc' },
        { rating: 'desc' },
      ],
      take: limit,
      skip: offset,
    })
  }

  // Optimize recommendation queries
  static optimizeRecommendationQuery(sessionId: string, limit: number = 20) {
    if (!prisma) throw new Error('Prisma client not initialized')
    return (prisma as PrismaClient).product.findMany({
      where: {
        status: 'APPROVED',
        inStock: true,
        availability: 'IN_STOCK',
      },
      orderBy: [
        { qualityScore: 'desc' },
        { popularityScore: 'desc' },
        { rating: 'desc' },
      ],
      take: limit,
    })
  }
}

// Export query optimizer
