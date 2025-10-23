#!/usr/bin/env tsx

import { auditAccessibility, AccessibilityIssue } from '@/lib/accessibility'
import { checkColorContrast } from '@/lib/accessibility'

interface AuditReport {
  timestamp: string
  url: string
  score: number
  compliance: {
    level: 'A' | 'AA' | 'AAA'
    percentage: number
  }
  issues: AccessibilityIssue[]
  recommendations: string[]
  summary: {
    totalIssues: number
    criticalIssues: number
    highIssues: number
    mediumIssues: number
    lowIssues: number
    categories: Record<string, number>
  }
}

class AccessibilityAuditor {
  private issues: AccessibilityIssue[] = []
  private recommendations: string[] = []

  async runAudit(url: string = 'http://localhost:3000'): Promise<AuditReport> {
    console.log('🔍 Starting accessibility audit...')
    console.log(`📋 Auditing: ${url}`)

    try {
      // Run comprehensive accessibility audit
      const audit = await auditAccessibility()

      this.issues = audit.issues
      this.recommendations = audit.recommendations

      // Generate summary
      const summary = this.generateSummary()

      const report: AuditReport = {
        timestamp: new Date().toISOString(),
        url,
        score: audit.score,
        compliance: audit.compliance,
        issues: this.issues,
        recommendations: this.recommendations,
        summary,
      }

      this.displayReport(report)
      return report
    } catch (error) {
      console.error('❌ Audit failed:', error)
      throw error
    }
  }

  private generateSummary() {
    const categories: Record<string, number> = {}
    let criticalIssues = 0
    let highIssues = 0
    let mediumIssues = 0
    let lowIssues = 0

    this.issues.forEach((issue) => {
      // Count by severity
      switch (issue.severity) {
        case 'critical':
          criticalIssues++
          break
        case 'high':
          highIssues++
          break
        case 'medium':
          mediumIssues++
          break
        case 'low':
          lowIssues++
          break
      }

      // Count by category
      categories[issue.category] = (categories[issue.category] || 0) + 1
    })

    return {
      totalIssues: this.issues.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      categories,
    }
  }

  private displayReport(report: AuditReport) {
    console.log('\n📊 Accessibility Audit Report')
    console.log('='.repeat(50))
    console.log(`🕒 Timestamp: ${report.timestamp}`)
    console.log(`🌐 URL: ${report.url}`)
    console.log(`📈 Score: ${report.score}/100`)
    console.log(
      `✅ Compliance: ${report.compliance.level} (${report.compliance.percentage.toFixed(1)}%)`
    )

    console.log('\n📋 Summary')
    console.log('-'.repeat(30))
    console.log(`Total Issues: ${report.summary.totalIssues}`)
    console.log(`Critical: ${report.summary.criticalIssues}`)
    console.log(`High: ${report.summary.highIssues}`)
    console.log(`Medium: ${report.summary.mediumIssues}`)
    console.log(`Low: ${report.summary.lowIssues}`)

    console.log('\n📂 Issues by Category')
    console.log('-'.repeat(30))
    Object.entries(report.summary.categories).forEach(([category, count]) => {
      console.log(`${category}: ${count}`)
    })

    if (report.issues.length > 0) {
      console.log('\n🚨 Issues Found')
      console.log('-'.repeat(30))

      report.issues.forEach((issue, index) => {
        const severityIcon = this.getSeverityIcon(issue.severity)
        const typeIcon = this.getTypeIcon(issue.type)

        console.log(
          `\n${index + 1}. ${severityIcon} ${typeIcon} ${issue.message}`
        )
        console.log(`   Category: ${issue.category}`)
        console.log(`   WCAG Criteria: ${issue.wcagCriteria.join(', ')}`)
        console.log(`   Suggestion: ${issue.suggestion}`)

        if (issue.element) {
          console.log(`   Element: ${issue.element}`)
        }
        if (issue.selector) {
          console.log(`   Selector: ${issue.selector}`)
        }
      })
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations')
      console.log('-'.repeat(30))
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })
    }

    console.log('\n🎯 Next Steps')
    console.log('-'.repeat(30))
    if (report.summary.criticalIssues > 0) {
      console.log('1. Fix critical issues immediately')
    }
    if (report.summary.highIssues > 0) {
      console.log('2. Address high-priority issues')
    }
    if (report.summary.mediumIssues > 0) {
      console.log('3. Plan fixes for medium-priority issues')
    }
    if (report.summary.lowIssues > 0) {
      console.log('4. Consider low-priority improvements')
    }

    console.log('\n✨ Audit Complete!')
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔴'
      case 'high':
        return '🟠'
      case 'medium':
        return '🟡'
      case 'low':
        return '🟢'
      default:
        return '⚪'
    }
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return '📝'
    }
  }

  // Color contrast checker
  checkColorContrast(foreground: string, background: string) {
    console.log(`\n🎨 Checking color contrast: ${foreground} on ${background}`)

    const result = checkColorContrast(foreground, background)

    console.log(`Ratio: ${result.ratio.toFixed(2)}:1`)
    console.log(`Level: ${result.level}`)
    console.log(`Passing: ${result.isPassing ? '✅' : '❌'}`)

    if (!result.isPassing) {
      console.log('⚠️  This color combination does not meet WCAG AA standards')
      console.log('💡 Consider increasing the contrast ratio to at least 4.5:1')
    }

    return result
  }

  // Generate accessibility report file
  async generateReportFile(
    report: AuditReport,
    filename: string = 'accessibility-report.json'
  ) {
    const fs = await import('fs/promises')
    const path = await import('path')

    const reportPath = path.join(process.cwd(), 'reports', filename)

    // Ensure reports directory exists
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Report saved to: ${reportPath}`)

    return reportPath
  }

  // Generate HTML report
  async generateHTMLReport(
    report: AuditReport,
    filename: string = 'accessibility-report.html'
  ) {
    const fs = await import('fs/promises')
    const path = await import('path')

    const html = this.generateHTML(report)
    const reportPath = path.join(process.cwd(), 'reports', filename)

    // Ensure reports directory exists
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    await fs.writeFile(reportPath, html)
    console.log(`🌐 HTML report saved to: ${reportPath}`)

    return reportPath
  }

  private generateHTML(report: AuditReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Audit Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .score { font-size: 3em; font-weight: bold; color: ${report.score >= 80 ? '#4CAF50' : report.score >= 60 ? '#FF9800' : '#F44336'}; }
        .compliance { font-size: 1.2em; color: #666; margin-top: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .number { font-size: 2em; font-weight: bold; color: #2196F3; }
        .issues { margin: 30px 0; }
        .issue { background: #fff; border-left: 4px solid ${report.issues.some((i) => i.severity === 'critical') ? '#F44336' : '#FF9800'}; padding: 15px; margin: 10px 0; border-radius: 0 6px 6px 0; }
        .issue-header { font-weight: bold; margin-bottom: 8px; }
        .issue-details { color: #666; font-size: 0.9em; }
        .recommendations { background: #e8f5e8; padding: 20px; border-radius: 6px; margin: 30px 0; }
        .recommendations h3 { margin-top: 0; color: #2e7d32; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin: 8px 0; }
        .severity-critical { border-left-color: #F44336; }
        .severity-high { border-left-color: #FF9800; }
        .severity-medium { border-left-color: #FFC107; }
        .severity-low { border-left-color: #4CAF50; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Accessibility Audit Report</h1>
            <div class="score">${report.score}/100</div>
            <div class="compliance">WCAG ${report.compliance.level} Compliance: ${report.compliance.percentage.toFixed(1)}%</div>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
            <p>URL: ${report.url}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Issues</h3>
                <div class="number">${report.summary.totalIssues}</div>
            </div>
            <div class="summary-card">
                <h3>Critical</h3>
                <div class="number">${report.summary.criticalIssues}</div>
            </div>
            <div class="summary-card">
                <h3>High</h3>
                <div class="number">${report.summary.highIssues}</div>
            </div>
            <div class="summary-card">
                <h3>Medium</h3>
                <div class="number">${report.summary.mediumIssues}</div>
            </div>
            <div class="summary-card">
                <h3>Low</h3>
                <div class="number">${report.summary.lowIssues}</div>
            </div>
        </div>
        
        ${
          report.issues.length > 0
            ? `
        <div class="issues">
            <h2>Issues Found</h2>
            ${report.issues
              .map(
                (issue) => `
                <div class="issue severity-${issue.severity}">
                    <div class="issue-header">${issue.message}</div>
                    <div class="issue-details">
                        <strong>Category:</strong> ${issue.category}<br>
                        <strong>WCAG Criteria:</strong> ${issue.wcagCriteria.join(', ')}<br>
                        <strong>Suggestion:</strong> ${issue.suggestion}
                        ${issue.element ? `<br><strong>Element:</strong> ${issue.element}` : ''}
                        ${issue.selector ? `<br><strong>Selector:</strong> ${issue.selector}` : ''}
                    </div>
                </div>
            `
              )
              .join('')}
        </div>
        `
            : ''
        }
        
        ${
          report.recommendations.length > 0
            ? `
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${report.recommendations.map((rec) => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        `
            : ''
        }
    </div>
</body>
</html>
    `
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const url = args[0] || 'http://localhost:3000'
  const format = args[1] || 'console'

  const auditor = new AccessibilityAuditor()

  try {
    const report = await auditor.runAudit(url)

    if (format === 'json') {
      await auditor.generateReportFile(report)
    } else if (format === 'html') {
      await auditor.generateHTMLReport(report)
    } else if (format === 'both') {
      await auditor.generateReportFile(report)
      await auditor.generateHTMLReport(report)
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Audit failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { AccessibilityAuditor }
