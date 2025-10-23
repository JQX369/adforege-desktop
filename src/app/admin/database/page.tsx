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
import {
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react'

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  connectionCount: number
  activeQueries: number
  slowQueries: number
  recentErrors: number
  responseTime: number
}

interface DatabaseStats {
  totalQueries: number
  averageQueryTime: number
  slowestQuery: { query: string; duration: number } | null
  errorRate: number
}

interface SlowQuery {
  query: string
  duration: number
  timestamp: Date
}

interface ConnectionError {
  error: string
  timestamp: Date
}

export default function DatabaseDashboard() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null)
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([])
  const [connectionErrors, setConnectionErrors] = useState<ConnectionError[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchDatabaseStatus = async () => {
    setIsLoading(true)

    try {
      // Simulate API calls (in production, these would be real endpoints)
      const healthResponse = await fetch('/api/admin/database/health')
      const statsResponse = await fetch('/api/admin/database/stats')
      const slowQueriesResponse = await fetch(
        '/api/admin/database/slow-queries'
      )
      const errorsResponse = await fetch('/api/admin/database/errors')

      // Mock data for demonstration
      const mockHealth: DatabaseHealth = {
        status: 'healthy',
        connectionCount: 12,
        activeQueries: 3,
        slowQueries: 2,
        recentErrors: 0,
        responseTime: 45,
      }

      const mockStats: DatabaseStats = {
        totalQueries: 15420,
        averageQueryTime: 23.5,
        slowestQuery: {
          query:
            "SELECT * FROM products WHERE categories @> ARRAY['electronics'] ORDER BY quality_score DESC",
          duration: 1250,
        },
        errorRate: 0.02,
      }

      const mockSlowQueries: SlowQuery[] = [
        {
          query:
            "SELECT * FROM products WHERE categories @> ARRAY['electronics'] ORDER BY quality_score DESC",
          duration: 1250,
          timestamp: new Date(Date.now() - 300000),
        },
        {
          query:
            'SELECT COUNT(*) FROM swipes WHERE user_id = $1 AND action = $2',
          duration: 890,
          timestamp: new Date(Date.now() - 600000),
        },
      ]

      const mockErrors: ConnectionError[] = [
        {
          error: 'Connection timeout after 30 seconds',
          timestamp: new Date(Date.now() - 900000),
        },
      ]

      setHealth(mockHealth)
      setStats(mockStats)
      setSlowQueries(mockSlowQueries)
      setConnectionErrors(mockErrors)
      setLastChecked(new Date())
    } catch (error) {
      console.error('Failed to fetch database status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDatabaseStatus()

    // Refresh every 30 seconds
    const interval = setInterval(fetchDatabaseStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'unhealthy':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Healthy
          </Badge>
        )
      case 'degraded':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Degraded
          </Badge>
        )
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Database Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor database performance, connections, and query optimization
        </p>
      </div>

      {/* Database Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Database Status
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {health && getStatusIcon(health.status)}
              <span className="text-2xl font-bold">
                {health ? getStatusBadge(health.status) : 'Loading...'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Response time: {health ? `${health.responseTime}ms` : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Connections
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.connectionCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active queries: {health?.activeQueries || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {health?.slowQueries || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Recent errors: {health?.recentErrors || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? `${stats.averageQueryTime.toFixed(1)}ms` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Avg query time</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Database Actions</CardTitle>
            <CardDescription>
              Database management and optimization tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={fetchDatabaseStatus}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                {isLoading ? 'Refreshing...' : 'Refresh Status'}
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Analyze Queries
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Optimize Indexes
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

      {/* Database Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Query Statistics</CardTitle>
              <CardDescription>
                Overall database performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Queries
                  </span>
                  <span className="text-sm font-medium">
                    {stats.totalQueries.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Average Query Time
                  </span>
                  <span className="text-sm font-medium">
                    {stats.averageQueryTime.toFixed(2)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Error Rate
                  </span>
                  <span className="text-sm font-medium">
                    {(stats.errorRate * 100).toFixed(2)}%
                  </span>
                </div>
                {stats.slowestQuery && (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Slowest Query
                    </span>
                    <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                      {stats.slowestQuery.query.substring(0, 100)}...
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Duration: {stats.slowestQuery.duration}ms
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connection Health</CardTitle>
              <CardDescription>
                Database connection status and metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-medium">
                    {health ? getStatusBadge(health.status) : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Response Time
                  </span>
                  <span className="text-sm font-medium">
                    {health?.responseTime || 0}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Active Queries
                  </span>
                  <span className="text-sm font-medium">
                    {health?.activeQueries || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Recent Errors
                  </span>
                  <span className="text-sm font-medium">
                    {health?.recentErrors || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Slow Queries */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Slow Queries</CardTitle>
            <CardDescription>
              Queries taking longer than 1 second to execute
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {slowQueries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No slow queries detected
                </p>
              ) : (
                slowQueries.map((query, index) => (
                  <div key={index} className="border rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium">
                        Query #{index + 1}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800"
                      >
                        {query.duration}ms
                      </Badge>
                    </div>
                    <div className="text-xs font-mono bg-muted p-2 rounded mb-2">
                      {query.query.substring(0, 200)}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Executed: {query.timestamp.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Errors */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Connection Errors</CardTitle>
            <CardDescription>
              Recent database connection errors and issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connectionErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No connection errors detected
                </p>
              ) : (
                connectionErrors.map((error, index) => (
                  <Alert key={index}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">{error.error}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {error.timestamp.toLocaleString()}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Optimization Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Database Optimization Tips</CardTitle>
          <CardDescription>
            Best practices for maintaining optimal database performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Query Optimization</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • Use appropriate indexes for frequently queried columns
                </li>
                <li>• Avoid SELECT * and select only needed columns</li>
                <li>• Use LIMIT to restrict result sets</li>
                <li>• Optimize JOIN operations and use proper foreign keys</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Connection Management</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use connection pooling to manage database connections</li>
                <li>• Set appropriate connection timeouts</li>
                <li>• Monitor connection usage and prevent leaks</li>
                <li>• Implement retry logic for failed connections</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Indexing Strategy</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Create composite indexes for multi-column queries</li>
                <li>• Monitor index usage and remove unused indexes</li>
                <li>• Use partial indexes for filtered queries</li>
                <li>• Consider covering indexes for read-heavy workloads</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Monitoring & Maintenance</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Regularly analyze slow query logs</li>
                <li>• Monitor database size and growth trends</li>
                <li>• Schedule regular maintenance tasks</li>
                <li>• Set up alerts for performance degradation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
