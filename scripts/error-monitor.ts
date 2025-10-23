#!/usr/bin/env tsx

import { errorHandler } from '@/lib/error-handler'
import { ErrorType, ErrorSeverity } from '@/lib/error-handler'

interface MonitoringConfig {
  alertThresholds: {
    critical: number
    high: number
    medium: number
    low: number
  }
  timeWindows: {
    critical: number // minutes
    high: number
    medium: number
    low: number
  }
  notificationChannels: string[]
}

class ErrorMonitor {
  private config: MonitoringConfig

  constructor(config: MonitoringConfig) {
    this.config = config
  }

  async monitor(): Promise<void> {
    console.log('🔍 Starting error monitoring...\n')

    const stats = errorHandler.getErrorStatistics()
    const logs = errorHandler.getErrorLogs(1000)

    await this.checkErrorThresholds(stats, logs)
    await this.analyzeErrorPatterns(logs)
    await this.generateReport(stats, logs)

    console.log('\n✅ Error monitoring completed')
  }

  private async checkErrorThresholds(stats: any, logs: any[]): Promise<void> {
    console.log('📊 Checking error thresholds...')

    const now = Date.now()
    const thresholds = this.config.alertThresholds
    const windows = this.config.timeWindows

    // Check critical errors in the last hour
    const criticalWindow = now - windows.critical * 60 * 1000
    const criticalErrors = logs.filter(
      (log) =>
        log.severity === ErrorSeverity.CRITICAL &&
        log.timestamp.getTime() > criticalWindow
    )

    if (criticalErrors.length >= thresholds.critical) {
      await this.sendAlert(
        'CRITICAL',
        `Critical error threshold exceeded: ${criticalErrors.length} errors in the last ${windows.critical} minutes`
      )
    }

    // Check high severity errors
    const highWindow = now - windows.high * 60 * 1000
    const highErrors = logs.filter(
      (log) =>
        log.severity === ErrorSeverity.HIGH &&
        log.timestamp.getTime() > highWindow
    )

    if (highErrors.length >= thresholds.high) {
      await this.sendAlert(
        'HIGH',
        `High severity error threshold exceeded: ${highErrors.length} errors in the last ${windows.high} minutes`
      )
    }

    // Check medium severity errors
    const mediumWindow = now - windows.medium * 60 * 1000
    const mediumErrors = logs.filter(
      (log) =>
        log.severity === ErrorSeverity.MEDIUM &&
        log.timestamp.getTime() > mediumWindow
    )

    if (mediumErrors.length >= thresholds.medium) {
      await this.sendAlert(
        'MEDIUM',
        `Medium severity error threshold exceeded: ${mediumErrors.length} errors in the last ${windows.medium} minutes`
      )
    }

    console.log(`  ✅ Thresholds checked`)
  }

  private async analyzeErrorPatterns(logs: any[]): Promise<void> {
    console.log('🔍 Analyzing error patterns...')

    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    // Analyze error types
    const errorTypes = new Map<string, number>()
    const errorSeverities = new Map<string, number>()
    const errorSources = new Map<string, number>()

    for (const log of logs) {
      // Count by type
      errorTypes.set(log.type, (errorTypes.get(log.type) || 0) + 1)

      // Count by severity
      errorSeverities.set(
        log.severity,
        (errorSeverities.get(log.severity) || 0) + 1
      )

      // Count by source (from context)
      const source = log.context?.url || log.context?.userAgent || 'unknown'
      errorSources.set(source, (errorSources.get(source) || 0) + 1)
    }

    // Find recurring errors
    const recurringErrors = new Map<string, number>()
    for (const log of logs) {
      const key = `${log.type}:${log.message}`
      recurringErrors.set(key, (recurringErrors.get(key) || 0) + 1)
    }

    // Report patterns
    console.log('  📈 Error Type Distribution:')
    for (const [type, count] of errorTypes.entries()) {
      console.log(`    ${type}: ${count}`)
    }

    console.log('  📈 Error Severity Distribution:')
    for (const [severity, count] of errorSeverities.entries()) {
      console.log(`    ${severity}: ${count}`)
    }

    // Find top recurring errors
    const topRecurring = Array.from(recurringErrors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    if (topRecurring.length > 0) {
      console.log('  🔄 Top Recurring Errors:')
      for (const [error, count] of topRecurring) {
        if (count > 1) {
          console.log(`    ${error}: ${count} occurrences`)
        }
      }
    }

    console.log(`  ✅ Pattern analysis completed`)
  }

  private async generateReport(stats: any, logs: any[]): Promise<void> {
    console.log('📋 Generating error report...')

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Calculate metrics
    const recentErrors = logs.filter((log) => log.timestamp > oneHourAgo)
    const dailyErrors = logs.filter((log) => log.timestamp > oneDayAgo)
    const unresolvedErrors = logs.filter((log) => !log.resolved)
    const criticalErrors = logs.filter(
      (log) => log.severity === ErrorSeverity.CRITICAL
    )

    // Generate report
    const report = {
      timestamp: now.toISOString(),
      summary: {
        totalErrors: stats.total,
        recentErrors: recentErrors.length,
        dailyErrors: dailyErrors.length,
        unresolvedErrors: unresolvedErrors.length,
        criticalErrors: criticalErrors.length,
      },
      breakdown: {
        byType: stats.byType,
        bySeverity: stats.bySeverity,
      },
      trends: {
        errorRate: this.calculateErrorRate(logs),
        resolutionRate: this.calculateResolutionRate(logs),
        criticalErrorRate: this.calculateCriticalErrorRate(logs),
      },
      recommendations: this.generateRecommendations(stats, logs),
    }

    console.log('  📊 Error Report Summary:')
    console.log(`    Total Errors: ${report.summary.totalErrors}`)
    console.log(`    Recent Errors (1h): ${report.summary.recentErrors}`)
    console.log(`    Daily Errors (24h): ${report.summary.dailyErrors}`)
    console.log(`    Unresolved Errors: ${report.summary.unresolvedErrors}`)
    console.log(`    Critical Errors: ${report.summary.criticalErrors}`)
    console.log(
      `    Error Rate: ${report.trends.errorRate.toFixed(2)} errors/hour`
    )
    console.log(
      `    Resolution Rate: ${(report.trends.resolutionRate * 100).toFixed(1)}%`
    )
    console.log(
      `    Critical Error Rate: ${(report.trends.criticalErrorRate * 100).toFixed(1)}%`
    )

    if (report.recommendations.length > 0) {
      console.log('  💡 Recommendations:')
      for (const recommendation of report.recommendations) {
        console.log(`    • ${recommendation}`)
      }
    }

    console.log(`  ✅ Report generated`)
  }

  private calculateErrorRate(logs: any[]): number {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const recentErrors = logs.filter(
      (log) => log.timestamp.getTime() > oneHourAgo
    )
    return recentErrors.length
  }

  private calculateResolutionRate(logs: any[]): number {
    if (logs.length === 0) return 0
    const resolvedCount = logs.filter((log) => log.resolved).length
    return resolvedCount / logs.length
  }

  private calculateCriticalErrorRate(logs: any[]): number {
    if (logs.length === 0) return 0
    const criticalCount = logs.filter(
      (log) => log.severity === ErrorSeverity.CRITICAL
    ).length
    return criticalCount / logs.length
  }

  private generateRecommendations(stats: any, logs: any[]): string[] {
    const recommendations: string[] = []

    // Check for high error rates
    const errorRate = this.calculateErrorRate(logs)
    if (errorRate > 10) {
      recommendations.push(
        'High error rate detected. Consider investigating root causes.'
      )
    }

    // Check for unresolved errors
    const unresolvedCount = logs.filter((log) => !log.resolved).length
    if (unresolvedCount > 50) {
      recommendations.push(
        'Many unresolved errors. Consider prioritizing error resolution.'
      )
    }

    // Check for critical errors
    const criticalCount = logs.filter(
      (log) => log.severity === ErrorSeverity.CRITICAL
    ).length
    if (criticalCount > 0) {
      recommendations.push(
        'Critical errors detected. Immediate attention required.'
      )
    }

    // Check for specific error types
    if (stats.byType.DATABASE > 10) {
      recommendations.push(
        'High database error count. Check database connectivity and performance.'
      )
    }

    if (stats.byType.EXTERNAL_API > 5) {
      recommendations.push(
        'External API errors detected. Check third-party service status.'
      )
    }

    if (stats.byType.VALIDATION > 20) {
      recommendations.push(
        'High validation error count. Consider improving input validation.'
      )
    }

    return recommendations
  }

  private async sendAlert(severity: string, message: string): Promise<void> {
    console.log(`🚨 ALERT [${severity}]: ${message}`)

    // In production, this would send to monitoring services
    // For now, just log to console
    console.log(
      `  Alert sent to channels: ${this.config.notificationChannels.join(', ')}`
    )
  }
}

// Default configuration
const defaultConfig: MonitoringConfig = {
  alertThresholds: {
    critical: 1,
    high: 5,
    medium: 20,
    low: 50,
  },
  timeWindows: {
    critical: 60, // 1 hour
    high: 60, // 1 hour
    medium: 60, // 1 hour
    low: 60, // 1 hour
  },
  notificationChannels: ['console', 'email', 'slack'],
}

// Run the monitoring
async function main() {
  const monitor = new ErrorMonitor(defaultConfig)

  try {
    await monitor.monitor()
  } catch (error) {
    console.error('Error monitoring failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { ErrorMonitor }
