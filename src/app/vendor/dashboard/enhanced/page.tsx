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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/ui/tabs'
import { Alert, AlertDescription } from '@/src/ui/alert'
import { Progress } from '@/src/ui/progress'
import {
  BarChart3,
  Package,
  Settings,
  User,
  TrendingUp,
  DollarSign,
  Eye,
  Heart,
  MousePointer,
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  Zap,
  Target,
  Users,
  Calendar,
  Download,
  Upload,
  Edit,
  Trash2,
  Plus,
  Star,
  Award,
  Gift,
} from 'lucide-react'
import { VendorAnalytics } from '@/src/features/vendor/vendor/VendorAnalytics'
import { BulkOperations } from '@/src/features/vendor/vendor/BulkOperations'
import { VendorOnboarding } from '@/src/features/vendor/vendor/VendorOnboarding'

interface VendorDashboardProps {
  vendorId: string
}

interface VendorStats {
  overview: {
    totalProducts: number
    activeProducts: number
    pendingProducts: number
    totalImpressions: number
    totalClicks: number
    totalSaves: number
    totalRevenue: number
    ctr: number
    saveRate: number
    conversionRate: number
  }
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
    status: 'success' | 'warning' | 'error'
  }>
  quickActions: Array<{
    id: string
    title: string
    description: string
    icon: React.ReactNode
    action: () => void
    variant: 'default' | 'secondary' | 'outline'
  }>
  performance: {
    score: number
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    badges: string[]
    nextMilestone: string
  }
}

export default function EnhancedVendorDashboard({
  vendorId,
}: VendorDashboardProps) {
  const [stats, setStats] = useState<VendorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [vendorId])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/vendor/dashboard/enhanced?vendorId=${vendorId}`
      )
      if (response.ok) {
        const data = await response.json()
        setStats(data)

        // Show onboarding if vendor is new
        if (data.showOnboarding) {
          setShowOnboarding(true)
        }
      } else {
        setError('Failed to load dashboard data')
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = async (actionId: string) => {
    try {
      const response = await fetch('/api/vendor/quick-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, vendorId }),
      })

      if (response.ok) {
        // Refresh dashboard data
        fetchDashboardData()
      }
    } catch (error) {
      console.error('Quick action failed:', error)
    }
  }

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'expert':
        return 'text-purple-600'
      case 'advanced':
        return 'text-blue-600'
      case 'intermediate':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getPerformanceIcon = (level: string) => {
    switch (level) {
      case 'expert':
        return <Award className="h-5 w-5" />
      case 'advanced':
        return <Star className="h-5 w-5" />
      case 'intermediate':
        return <TrendingUp className="h-5 w-5" />
      default:
        return <Target className="h-5 w-5" />
    }
  }

  if (showOnboarding) {
    return (
      <VendorOnboarding
        vendorId={vendorId}
        onComplete={() => {
          setShowOnboarding(false)
          fetchDashboardData()
        }}
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No dashboard data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your products and track performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getPerformanceIcon(stats.performance.level)}
            Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-3xl font-bold">
                {stats.performance.score}/100
              </div>
              <div
                className={`text-sm font-medium ${getPerformanceColor(stats.performance.level)}`}
              >
                {stats.performance.level.charAt(0).toUpperCase() +
                  stats.performance.level.slice(1)}{' '}
                Level
              </div>
              <p className="text-sm text-muted-foreground">
                {stats.performance.nextMilestone}
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-right">
                <Progress value={stats.performance.score} className="w-32" />
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                {stats.performance.badges.map((badge, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overview.totalProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.overview.activeProducts} active,{' '}
              {stats.overview.pendingProducts} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Impressions
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overview.totalImpressions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overview.totalClicks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              CTR: {(stats.overview.ctr * 100).toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.overview.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">+8% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks you can perform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {stats.quickActions.map((action) => (
                    <Button
                      key={action.id}
                      variant={action.variant}
                      className="justify-start h-auto p-4"
                      onClick={() => handleQuickAction(action.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {action.icon}
                        <div className="text-left">
                          <div className="font-medium">{action.title}</div>
                          <div className="text-sm opacity-70">
                            {action.description}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Your latest actions and updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg"
                    >
                      <div
                        className={`p-1 rounded-full ${
                          activity.status === 'success'
                            ? 'bg-green-100 text-green-600'
                            : activity.status === 'warning'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {activity.status === 'success' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : activity.status === 'warning' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {activity.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {activity.type}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <VendorAnalytics vendorId={vendorId} />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Management</CardTitle>
              <CardDescription>Manage your product listings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4" />
                <p>Product management interface would be implemented here</p>
                <p className="text-sm">
                  Including product editing, status management, and performance
                  tracking
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <BulkOperations vendorId={vendorId} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your vendor account preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4" />
                <p>Settings interface would be implemented here</p>
                <p className="text-sm">
                  Including profile management, notification preferences, and
                  billing settings
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
