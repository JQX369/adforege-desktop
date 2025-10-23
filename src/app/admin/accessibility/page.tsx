'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/ui/card'
import { Button } from '@/src/ui/button'
import { Badge } from '@/src/ui/badge'
import { Progress } from '@/src/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/ui/tabs'
import { Alert, AlertDescription } from '@/src/ui/alert'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Download,
  Eye,
  Keyboard,
  Volume2,
  Focus,
  Palette,
  Code,
} from 'lucide-react'

interface AccessibilityIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  severity: 'low' | 'medium' | 'high' | 'critical'
  category:
    | 'contrast'
    | 'keyboard'
    | 'screen-reader'
    | 'focus'
    | 'semantics'
    | 'aria'
  message: string
  element?: string
  selector?: string
  suggestion: string
  wcagCriteria: string[]
}

interface AccessibilityAudit {
  score: number
  issues: AccessibilityIssue[]
  recommendations: string[]
  compliance: {
    level: 'A' | 'AA' | 'AAA'
    percentage: number
  }
}

interface AccessibilityStats {
  totalIssues: number
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  categories: Record<string, number>
  lastAudit: string
  trends: {
    score: number[]
    issues: number[]
    compliance: number[]
  }
}

export default function AccessibilityDashboard() {
  const [audit, setAudit] = useState<AccessibilityAudit | null>(null)
  const [stats, setStats] = useState<AccessibilityStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAuditData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/accessibility/audit')
      if (!response.ok) throw new Error('Failed to fetch audit data')

      const data = await response.json()
      setAudit(data.audit)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/accessibility/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  useEffect(() => {
    fetchAuditData()
  }, [])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'contrast':
        return <Palette className="h-4 w-4" />
      case 'keyboard':
        return <Keyboard className="h-4 w-4" />
      case 'screen-reader':
        return <Volume2 className="h-4 w-4" />
      case 'focus':
        return <Focus className="h-4 w-4" />
      case 'semantics':
        return <Code className="h-4 w-4" />
      case 'aria':
        return <Code className="h-4 w-4" />
      default:
        return <Eye className="h-4 w-4" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getComplianceColor = (level: string) => {
    switch (level) {
      case 'AAA':
        return 'bg-green-100 text-green-800'
      case 'AA':
        return 'bg-blue-100 text-blue-800'
      case 'A':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load accessibility data: {error}
          </AlertDescription>
        </Alert>
        <Button onClick={fetchAuditData} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accessibility Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and improve your site's accessibility compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAuditData} disabled={isLoading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Run Audit
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {audit && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Accessibility Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${getScoreColor(audit.score)}`}
                >
                  {audit.score}/100
                </div>
                <Progress value={audit.score} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  WCAG Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getComplianceColor(audit.compliance.level)}>
                  {audit.compliance.level}
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">
                  {audit.compliance.percentage.toFixed(1)}% compliant
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{audit.issues.length}</div>
                <div className="text-sm text-muted-foreground">
                  {audit.issues.filter((i) => i.severity === 'critical').length}{' '}
                  critical
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Last Audit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {stats?.lastAudit
                    ? new Date(stats.lastAudit).toLocaleString()
                    : 'Never'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issues by Category */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Issues by Category</CardTitle>
                <CardDescription>
                  Breakdown of accessibility issues by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(stats.categories).map(([category, count]) => (
                    <div key={category} className="flex items-center space-x-2">
                      {getCategoryIcon(category)}
                      <span className="text-sm font-medium capitalize">
                        {category}
                      </span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Issues */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Issues</TabsTrigger>
              <TabsTrigger value="critical">Critical</TabsTrigger>
              <TabsTrigger value="high">High</TabsTrigger>
              <TabsTrigger value="medium">Medium</TabsTrigger>
              <TabsTrigger value="low">Low</TabsTrigger>
            </TabsList>

            {['all', 'critical', 'high', 'medium', 'low'].map((severity) => (
              <TabsContent key={severity} value={severity}>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {severity === 'all'
                        ? 'All Issues'
                        : `${severity.charAt(0).toUpperCase() + severity.slice(1)} Priority Issues`}
                    </CardTitle>
                    <CardDescription>
                      {
                        audit.issues.filter(
                          (issue) =>
                            severity === 'all' || issue.severity === severity
                        ).length
                      }{' '}
                      issues found
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {audit.issues
                        .filter(
                          (issue) =>
                            severity === 'all' || issue.severity === severity
                        )
                        .map((issue) => (
                          <div
                            key={issue.id}
                            className="border rounded-lg p-4 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                {getSeverityIcon(issue.severity)}
                                <span className="font-medium">
                                  {issue.message}
                                </span>
                              </div>
                              <Badge
                                variant={
                                  getSeverityColor(issue.severity) as any
                                }
                              >
                                {issue.severity}
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>
                                <strong>Category:</strong> {issue.category}
                              </div>
                              <div>
                                <strong>WCAG Criteria:</strong>{' '}
                                {issue.wcagCriteria.join(', ')}
                              </div>
                              <div>
                                <strong>Suggestion:</strong> {issue.suggestion}
                              </div>
                              {issue.element && (
                                <div>
                                  <strong>Element:</strong> {issue.element}
                                </div>
                              )}
                              {issue.selector && (
                                <div>
                                  <strong>Selector:</strong> {issue.selector}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Recommendations */}
          {audit.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>
                  Suggested improvements to enhance accessibility
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {audit.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Running accessibility audit...</span>
        </div>
      )}
    </div>
  )
}
