#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface VendorDashboardStats {
  totalVendors: number
  activeVendors: number
  onboardingCompleted: number
  onboardingPending: number
  totalProducts: number
  activeProducts: number
  pendingProducts: number
  totalRevenue: number
  averageRevenuePerVendor: number
  topPerformingVendors: Array<{
    id: string
    businessName: string
    totalProducts: number
    totalRevenue: number
    performanceScore: number
  }>
}

class VendorDashboardManager {
  async generateStats(): Promise<VendorDashboardStats> {
    console.log('📊 Generating vendor dashboard statistics...')

    // Get vendor counts
    const totalVendors = await prisma.vendor.count()
    const activeVendors = await prisma.vendor.count({
      where: { subscriptionStatus: 'ACTIVE' },
    })
    const onboardingCompleted = await prisma.vendor.count({
      where: { onboardingCompleted: true },
    })
    const onboardingPending = await prisma.vendor.count({
      where: { onboardingCompleted: false },
    })

    // Get product counts
    const totalProducts = await prisma.product.count()
    const activeProducts = await prisma.product.count({
      where: { status: 'APPROVED' },
    })
    const pendingProducts = await prisma.product.count({
      where: { status: 'PENDING' },
    })

    // Calculate revenue (simplified calculation)
    const saves = await prisma.recommendationEvent.count({
      where: { action: 'SAVE' },
    })
    const totalRevenue = saves * 0.1 // $0.10 per save

    // Get vendor performance data
    const vendors = await prisma.vendor.findMany({
      include: {
        products: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    const vendorPerformance = vendors.map((vendor) => {
      const totalProducts = vendor.products.length
      const activeProducts = vendor.products.filter(
        (p) => p.status === 'APPROVED'
      ).length

      // Simplified performance score calculation
      let performanceScore = 0
      if (totalProducts >= 10) performanceScore += 20
      if (totalProducts >= 50) performanceScore += 20
      if (activeProducts / totalProducts >= 0.8) performanceScore += 20
      if (vendor.onboardingCompleted) performanceScore += 20
      if (vendor.subscriptionStatus === 'ACTIVE') performanceScore += 20

      return {
        id: vendor.id,
        businessName: vendor.businessName || 'Unknown Business',
        totalProducts,
        totalRevenue: totalProducts * 0.1, // Simplified revenue calculation
        performanceScore,
      }
    })

    const topPerformingVendors = vendorPerformance
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10)

    const averageRevenuePerVendor =
      totalVendors > 0 ? totalRevenue / totalVendors : 0

    const stats: VendorDashboardStats = {
      totalVendors,
      activeVendors,
      onboardingCompleted,
      onboardingPending,
      totalProducts,
      activeProducts,
      pendingProducts,
      totalRevenue,
      averageRevenuePerVendor,
      topPerformingVendors,
    }

    return stats
  }

  displayStats(stats: VendorDashboardStats) {
    console.log('\n📈 Vendor Dashboard Statistics')
    console.log('='.repeat(50))

    console.log('\n👥 Vendor Overview')
    console.log('-'.repeat(30))
    console.log(`Total Vendors: ${stats.totalVendors}`)
    console.log(`Active Vendors: ${stats.activeVendors}`)
    console.log(`Onboarding Completed: ${stats.onboardingCompleted}`)
    console.log(`Onboarding Pending: ${stats.onboardingPending}`)

    console.log('\n📦 Product Overview')
    console.log('-'.repeat(30))
    console.log(`Total Products: ${stats.totalProducts}`)
    console.log(`Active Products: ${stats.activeProducts}`)
    console.log(`Pending Products: ${stats.pendingProducts}`)

    console.log('\n💰 Revenue Overview')
    console.log('-'.repeat(30))
    console.log(`Total Revenue: $${stats.totalRevenue.toFixed(2)}`)
    console.log(
      `Average Revenue per Vendor: $${stats.averageRevenuePerVendor.toFixed(2)}`
    )

    console.log('\n🏆 Top Performing Vendors')
    console.log('-'.repeat(30))
    stats.topPerformingVendors.forEach((vendor, index) => {
      console.log(`${index + 1}. ${vendor.businessName}`)
      console.log(`   Products: ${vendor.totalProducts}`)
      console.log(`   Revenue: $${vendor.totalRevenue.toFixed(2)}`)
      console.log(`   Performance Score: ${vendor.performanceScore}/100`)
      console.log('')
    })
  }

  async generateReport(): Promise<string> {
    const stats = await this.generateStats()

    const report = `
# Vendor Dashboard Report
Generated: ${new Date().toLocaleString()}

## Overview
- **Total Vendors:** ${stats.totalVendors}
- **Active Vendors:** ${stats.activeVendors}
- **Onboarding Completed:** ${stats.onboardingCompleted}
- **Onboarding Pending:** ${stats.onboardingPending}

## Products
- **Total Products:** ${stats.totalProducts}
- **Active Products:** ${stats.activeProducts}
- **Pending Products:** ${stats.pendingProducts}

## Revenue
- **Total Revenue:** $${stats.totalRevenue.toFixed(2)}
- **Average Revenue per Vendor:** $${stats.averageRevenuePerVendor.toFixed(2)}

## Top Performing Vendors
${stats.topPerformingVendors
  .map(
    (vendor, index) => `
${index + 1}. **${vendor.businessName}**
   - Products: ${vendor.totalProducts}
   - Revenue: $${vendor.totalRevenue.toFixed(2)}
   - Performance Score: ${vendor.performanceScore}/100
`
  )
  .join('')}

## Recommendations
${this.generateRecommendations(stats)}
`

    return report
  }

  private generateRecommendations(stats: VendorDashboardStats): string {
    const recommendations: string[] = []

    if (stats.onboardingPending > 0) {
      recommendations.push(
        `- ${stats.onboardingPending} vendors need to complete onboarding`
      )
    }

    if (stats.pendingProducts > 0) {
      recommendations.push(
        `- ${stats.pendingProducts} products are pending approval`
      )
    }

    if (stats.averageRevenuePerVendor < 10) {
      recommendations.push(
        '- Consider implementing revenue optimization strategies'
      )
    }

    if (stats.activeVendors / stats.totalVendors < 0.7) {
      recommendations.push('- Focus on vendor retention and activation')
    }

    if (recommendations.length === 0) {
      recommendations.push('- All metrics are performing well!')
    }

    return recommendations.join('\n')
  }

  async exportStats(format: 'json' | 'csv'): Promise<string> {
    const stats = await this.generateStats()

    if (format === 'json') {
      return JSON.stringify(stats, null, 2)
    } else {
      // CSV format
      const csvRows = [
        'Metric,Value',
        `Total Vendors,${stats.totalVendors}`,
        `Active Vendors,${stats.activeVendors}`,
        `Onboarding Completed,${stats.onboardingCompleted}`,
        `Onboarding Pending,${stats.onboardingPending}`,
        `Total Products,${stats.totalProducts}`,
        `Active Products,${stats.activeProducts}`,
        `Pending Products,${stats.pendingProducts}`,
        `Total Revenue,${stats.totalRevenue}`,
        `Average Revenue per Vendor,${stats.averageRevenuePerVendor}`,
      ]

      return csvRows.join('\n')
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'stats'

  const manager = new VendorDashboardManager()

  try {
    switch (command) {
      case 'stats':
        const stats = await manager.generateStats()
        manager.displayStats(stats)
        break

      case 'report':
        const report = await manager.generateReport()
        console.log(report)
        break

      case 'export':
        const format = args[1] || 'json'
        const exportData = await manager.exportStats(format as 'json' | 'csv')
        console.log(exportData)
        break

      default:
        console.log(
          'Usage: tsx scripts/vendor-dashboard.ts [stats|report|export] [format]'
        )
        console.log('  stats  - Display dashboard statistics (default)')
        console.log('  report - Generate markdown report')
        console.log('  export - Export data in JSON or CSV format')
        break
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Vendor dashboard error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { VendorDashboardManager }
