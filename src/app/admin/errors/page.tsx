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
import { Input } from '@/src/ui/input'
import { Textarea } from '@/src/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/ui/dialog'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react'

interface ErrorLog {
  id: string
  type: string
  severity: string
  message: string
  stack?: string
  context: Record<string, any>
  timestamp: Date
  statusCode: number
  isOperational: boolean
  retryable: boolean
  userMessage?: string
  technicalMessage?: string
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
  notes?: string
}

interface ErrorStats {
  total: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  recent: number
  critical: number
}

export default function ErrorDashboard() {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [resolvedFilter, setResolvedFilter] = useState<string>('all')
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')

  const fetchErrorData = async () => {
    setIsLoading(true)

    try {
      // Simulate API calls (in production, these would be real endpoints)
      const logsResponse = await fetch('/api/admin/errors/logs')
      const statsResponse = await fetch('/api/admin/errors/stats')

      // Mock data for demonstration
      const mockLogs: ErrorLog[] = [
        {
          id: 'err_1',
          type: 'DATABASE',
          severity: 'HIGH',
          message: 'Database connection timeout',
          stack:
            'Error: Connection timeout\n    at Database.connect (/app/lib/database.ts:45:12)',
          context: { userId: 'user_123', sessionId: 'session_456' },
          timestamp: new Date(Date.now() - 300000),
          statusCode: 500,
          isOperational: true,
          retryable: true,
          userMessage: 'A database error occurred. Please try again.',
          technicalMessage: 'Database connection timeout after 30 seconds',
          resolved: false,
        },
        {
          id: 'err_2',
          type: 'VALIDATION',
          severity: 'MEDIUM',
          message: 'Invalid email format',
          context: { email: 'invalid-email' },
          timestamp: new Date(Date.now() - 600000),
          statusCode: 400,
          isOperational: true,
          retryable: false,
          userMessage: 'Please check your input and try again.',
          technicalMessage: 'Invalid email format provided',
          resolved: true,
          resolvedAt: new Date(Date.now() - 300000),
          resolvedBy: 'admin@fairywize.com',
          notes: 'Fixed email validation regex',
        },
        {
          id: 'err_3',
          type: 'EXTERNAL_API',
          severity: 'CRITICAL',
          message: 'OpenAI API rate limit exceeded',
          context: { apiKey: 'sk-***', endpoint: '/v1/embeddings' },
          timestamp: new Date(Date.now() - 900000),
          statusCode: 429,
          isOperational: true,
          retryable: true,
          userMessage: 'External service is temporarily unavailable.',
          technicalMessage: 'OpenAI API rate limit exceeded',
          resolved: false,
        },
      ]

      const mockStats: ErrorStats = {
        total: 1542,
        byType: {
          DATABASE: 45,
          VALIDATION: 123,
          EXTERNAL_API: 67,
          NETWORK: 89,
          INTERNAL: 234,
          AUTHENTICATION: 56,
          AUTHORIZATION: 23,
          NOT_FOUND: 145,
          RATE_LIMIT: 78,
          CLIENT: 234,
          TIMEOUT: 45,
          CONFIGURATION: 12,
        },
        bySeverity: {
          LOW: 456,
          MEDIUM: 789,
          HIGH: 234,
          CRITICAL: 63,
        },
        recent: 23,
        critical: 5,
      }

      setErrorLogs(mockLogs)
      setStats(mockStats)
    } catch (error) {
      console.error('Failed to fetch error data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchErrorData()

    // Refresh every 30 seconds
    const interval = setInterval(fetchErrorData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'MEDIUM':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'HIGH':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'CRITICAL':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Low
          </Badge>
        )
      case 'MEDIUM':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Medium
          </Badge>
        )
      case 'HIGH':
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            High
          </Badge>
        )
      case 'CRITICAL':
        return <Badge variant="destructive">Critical</Badge>
      default:
        return null
    }
  }

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      DATABASE: 'bg-blue-100 text-blue-800',
      VALIDATION: 'bg-purple-100 text-purple-800',
      EXTERNAL_API: 'bg-indigo-100 text-indigo-800',
      NETWORK: 'bg-gray-100 text-gray-800',
      INTERNAL: 'bg-red-100 text-red-800',
      AUTHENTICATION: 'bg-pink-100 text-pink-800',
      AUTHORIZATION: 'bg-rose-100 text-rose-800',
      NOT_FOUND: 'bg-slate-100 text-slate-800',
      RATE_LIMIT: 'bg-amber-100 text-amber-800',
      CLIENT: 'bg-cyan-100 text-cyan-800',
      TIMEOUT: 'bg-orange-100 text-orange-800',
      CONFIGURATION: 'bg-teal-100 text-teal-800',
    }

    return (
      <Badge
        variant="outline"
        className={colors[type] || 'bg-gray-100 text-gray-800'}
      >
        {type}
      </Badge>
    )
  }

  const filteredLogs = errorLogs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity =
      severityFilter === 'all' || log.severity === severityFilter
    const matchesType = typeFilter === 'all' || log.type === typeFilter
    const matchesResolved =
      resolvedFilter === 'all' ||
      (resolvedFilter === 'resolved' && log.resolved) ||
      (resolvedFilter === 'unresolved' && !log.resolved)

    return matchesSearch && matchesSeverity && matchesType && matchesResolved
  })

  const resolveError = async (errorId: string) => {
    try {
      // Simulate API call
      await fetch(`/api/admin/errors/${errorId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: resolveNotes }),
      })

      // Update local state
      setErrorLogs((prev) =>
        prev.map((log) =>
          log.id === errorId
            ? {
                ...log,
                resolved: true,
                resolvedAt: new Date(),
                resolvedBy: 'admin',
                notes: resolveNotes,
              }
            : log
        )
      )

      setSelectedError(null)
      setResolveNotes('')
    } catch (error) {
      console.error('Failed to resolve error:', error)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Error Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and manage application errors and exceptions
        </p>
      </div>

      {/* Error Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Errors
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Recent: {stats.recent} (1h)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Critical Errors
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.critical}
              </div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Recent Errors
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.recent}
              </div>
              <p className="text-xs text-muted-foreground">Last hour</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {errorLogs.filter((log) => log.resolved).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully resolved
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Distribution */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Errors by Type</CardTitle>
              <CardDescription>
                Distribution of errors by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm">{type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{count}</span>
                      {getTypeBadge(type)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Errors by Severity</CardTitle>
              <CardDescription>
                Distribution of errors by severity level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.bySeverity).map(([severity, count]) => (
                  <div
                    key={severity}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm">{severity}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{count}</span>
                      {getSeverityBadge(severity)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Logs</CardTitle>
            <CardDescription>Search and filter error logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search errors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Severities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Types</option>
                <option value="DATABASE">Database</option>
                <option value="VALIDATION">Validation</option>
                <option value="EXTERNAL_API">External API</option>
                <option value="NETWORK">Network</option>
                <option value="INTERNAL">Internal</option>
              </select>
              <select
                value={resolvedFilter}
                onChange={(e) => setResolvedFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="resolved">Resolved</option>
                <option value="unresolved">Unresolved</option>
              </select>
              <Button onClick={fetchErrorData} disabled={isLoading}>
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Logs */}
      <div className="space-y-4">
        {filteredLogs.map((log) => (
          <Card key={log.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getSeverityIcon(log.severity)}
                    <h3 className="font-semibold">{log.message}</h3>
                    {getSeverityBadge(log.severity)}
                    {getTypeBadge(log.type)}
                    {log.resolved && (
                      <Badge
                        variant="default"
                        className="bg-green-100 text-green-800"
                      >
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {log.userMessage || log.technicalMessage}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    <div>ID: {log.id}</div>
                    <div>Time: {log.timestamp.toLocaleString()}</div>
                    <div>Status: {log.statusCode}</div>
                    {log.context.userId && (
                      <div>User: {log.context.userId}</div>
                    )}
                    {log.context.sessionId && (
                      <div>Session: {log.context.sessionId}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Error Details</DialogTitle>
                        <DialogDescription>
                          Technical details for error {log.id}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Message</h4>
                          <p className="text-sm">{log.message}</p>
                        </div>
                        {log.stack && (
                          <div>
                            <h4 className="font-semibold mb-2">Stack Trace</h4>
                            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                              {log.stack}
                            </pre>
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold mb-2">Context</h4>
                          <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                        {log.resolved && (
                          <div>
                            <h4 className="font-semibold mb-2">Resolution</h4>
                            <p className="text-sm">
                              Resolved by {log.resolvedBy} on{' '}
                              {log.resolvedAt?.toLocaleString()}
                            </p>
                            {log.notes && (
                              <p className="text-sm text-muted-foreground mt-2">
                                Notes: {log.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  {!log.resolved && (
                    <Dialog>
                      <DialogTrigger>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setSelectedError(log)}
                        >
                          Resolve
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Resolve Error</DialogTitle>
                          <DialogDescription>
                            Mark this error as resolved and add notes
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Error</h4>
                            <p className="text-sm">{log.message}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">
                              Resolution Notes
                            </label>
                            <Textarea
                              value={resolveNotes}
                              onChange={(e) => setResolveNotes(e.target.value)}
                              placeholder="Describe how this error was resolved..."
                              className="mt-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => resolveError(log.id)}
                              className="flex-1"
                            >
                              Mark as Resolved
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedError(null)
                                setResolveNotes('')
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredLogs.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              No errors found matching your criteria
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
