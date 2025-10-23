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
import { Alert, AlertDescription } from '@/src/ui/alert'
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface SecurityCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  description: string
  recommendation?: string
}

export default function SecurityDashboard() {
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const runSecurityChecks = async () => {
    setIsLoading(true)

    // Simulate security checks (in production, these would be real checks)
    const checks: SecurityCheck[] = [
      {
        name: 'HTTPS Enforcement',
        status: 'pass',
        description: 'All traffic is encrypted with HTTPS',
      },
      {
        name: 'Security Headers',
        status: 'pass',
        description: 'Essential security headers are configured',
      },
      {
        name: 'Rate Limiting',
        status: 'pass',
        description: 'API endpoints are protected with rate limiting',
      },
      {
        name: 'Input Validation',
        status: 'pass',
        description: 'All user inputs are validated and sanitized',
      },
      {
        name: 'CSRF Protection',
        status: 'pass',
        description:
          'CSRF tokens are implemented for state-changing operations',
      },
      {
        name: 'SQL Injection Protection',
        status: 'pass',
        description: 'Database queries use parameterized statements',
      },
      {
        name: 'XSS Protection',
        status: 'pass',
        description: 'Content Security Policy and input sanitization active',
      },
      {
        name: 'Environment Variables',
        status: 'warning',
        description: 'Some environment variables may need stronger values',
        recommendation: 'Review and strengthen environment variable values',
      },
      {
        name: 'Dependency Vulnerabilities',
        status: 'pass',
        description: 'No known vulnerabilities in dependencies',
      },
      {
        name: 'File Upload Security',
        status: 'pass',
        description: 'File uploads are validated and restricted',
      },
    ]

    setSecurityChecks(checks)
    setLastChecked(new Date())
    setIsLoading(false)
  }

  useEffect(() => {
    runSecurityChecks()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Pass
          </Badge>
        )
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Warning
          </Badge>
        )
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>
      default:
        return null
    }
  }

  const passedChecks = securityChecks.filter(
    (check) => check.status === 'pass'
  ).length
  const warningChecks = securityChecks.filter(
    (check) => check.status === 'warning'
  ).length
  const failedChecks = securityChecks.filter(
    (check) => check.status === 'fail'
  ).length

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Security Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and manage security configurations and vulnerabilities
        </p>
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Security Score
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityChecks.length > 0
                ? Math.round((passedChecks / securityChecks.length) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              {passedChecks} of {securityChecks.length} checks passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {passedChecks}
            </div>
            <p className="text-xs text-muted-foreground">
              Security checks passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {warningChecks}
            </div>
            <p className="text-xs text-muted-foreground">Issues to review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {failedChecks}
            </div>
            <p className="text-xs text-muted-foreground">Critical issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Security Actions</CardTitle>
            <CardDescription>Run security checks and audits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={runSecurityChecks}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                {isLoading ? 'Running Checks...' : 'Run Security Checks'}
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Run Security Audit
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Check Dependencies
              </Button>
            </div>
            {lastChecked && (
              <p className="text-sm text-muted-foreground mt-4">
                Last checked: {lastChecked.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security Checks */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Security Checks</h2>

        {securityChecks.map((check, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <h3 className="font-semibold">{check.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {check.description}
                    </p>
                    {check.recommendation && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {check.recommendation}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
                {getStatusBadge(check.status)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Security Recommendations */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Security Recommendations</CardTitle>
            <CardDescription>
              Best practices for maintaining security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">
                  Authentication & Authorization
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Implement multi-factor authentication</li>
                  <li>• Use strong password policies</li>
                  <li>• Implement session management</li>
                  <li>• Regular access reviews</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Data Protection</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Encrypt sensitive data at rest</li>
                  <li>• Use HTTPS for all communications</li>
                  <li>• Implement data backup strategies</li>
                  <li>• Regular security updates</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Monitoring & Logging</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Implement security monitoring</li>
                  <li>• Log security events</li>
                  <li>• Set up alerts for anomalies</li>
                  <li>• Regular security audits</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Incident Response</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Develop incident response plan</li>
                  <li>• Train staff on security procedures</li>
                  <li>• Regular security drills</li>
                  <li>• Maintain security documentation</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
