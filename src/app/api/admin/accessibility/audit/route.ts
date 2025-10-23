import { NextResponse } from 'next/server'
import { auditAccessibility } from '@/lib/accessibility'

export async function GET() {
  try {
    // Run accessibility audit
    const audit = await auditAccessibility()

    // Generate mock stats for now (in a real app, this would come from a database)
    const stats = {
      totalIssues: audit.issues.length,
      criticalIssues: audit.issues.filter((i) => i.severity === 'critical')
        .length,
      highIssues: audit.issues.filter((i) => i.severity === 'high').length,
      mediumIssues: audit.issues.filter((i) => i.severity === 'medium').length,
      lowIssues: audit.issues.filter((i) => i.severity === 'low').length,
      categories: audit.issues.reduce(
        (acc, issue) => {
          acc[issue.category] = (acc[issue.category] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
      lastAudit: new Date().toISOString(),
      trends: {
        score: [audit.score],
        issues: [audit.issues.length],
        compliance: [audit.compliance.percentage],
      },
    }

    return NextResponse.json({
      audit,
      stats,
    })
  } catch (error) {
    console.error('Accessibility audit failed:', error)
    return NextResponse.json(
      { error: 'Failed to run accessibility audit' },
      { status: 500 }
    )
  }
}
