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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/ui/select'
import {
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  Heart,
  ShoppingCart,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react'

interface VendorAnalyticsProps {
  vendorId: string
}

interface AnalyticsData {
  overview: {
    totalProducts: number
    totalImpressions: number
    totalClicks: number
    totalSaves: number
    totalRevenue: number
    ctr: number
    saveRate: number
    conversionRate: number
  }
  trends: {
    impressions: Array<{ date: string; value: number }>
    clicks: Array<{ date: string; value: number }>
    saves: Array<{ date: string; value: number }>
    revenue: Array<{ date: string; value: number }>
  }
  topProducts: Array<{
    id: string
    title: string
    imageUrl?: string
    price?: number
    currency?: string
    impressions: number
    clicks: number
    saves: number
    ctr: number
    saveRate: number
    revenue: number
  }>
  demographics: {
    ageGroups: Array<{ group: string; percentage: number }>
    genders: Array<{ gender: string; percentage: number }>
    locations: Array<{ location: string; percentage: number }>
  }
  timeframes: {
    hourly: Array<{ hour: number; value: number }>
    daily: Array<{ day: string; value: number }>
    weekly: Array<{ week: string; value: number }>
  }
}

export function VendorAnalytics({ vendorId }: VendorAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('7d')
  const [metric, setMetric] = useState('impressions')

  useEffect(() => {
    fetchAnalytics()
  }, [vendorId, timeframe])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/vendor/analytics?timeframe=${timeframe}`
      )
      if (response.ok) {
        const analyticsData = await response.json()
        setData(analyticsData)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(
        `/api/vendor/analytics/export?format=${format}&timeframe=${timeframe}`
      )
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vendor-analytics-${timeframe}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to export data:', error)
    }
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

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Track your product performance and customer engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => exportData('csv')}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportData('json')}
          >
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Impressions
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overview.totalImpressions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              +12% from last period
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
              {data.overview.totalClicks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              CTR: {(data.overview.ctr * 100).toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saves</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overview.totalSaves.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Save rate: {(data.overview.saveRate * 100).toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimated Revenue
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.overview.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Conversion: {(data.overview.conversionRate * 100).toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="timeframes">Time Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Track how your products perform over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>Chart visualization would be implemented here</p>
                  <p className="text-sm">Using Chart.js or similar library</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Products</CardTitle>
              <CardDescription>
                Your best-performing products by engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-sm font-medium text-muted-foreground">
                        #{index + 1}
                      </div>
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium">{product.title}</div>
                        {product.price && (
                          <div className="text-sm text-muted-foreground">
                            {product.currency || 'USD'}{' '}
                            {product.price.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">
                          {product.impressions.toLocaleString()}
                        </div>
                        <div className="text-muted-foreground">Impressions</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">
                          {product.clicks.toLocaleString()}
                        </div>
                        <div className="text-muted-foreground">Clicks</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">
                          {product.saves.toLocaleString()}
                        </div>
                        <div className="text-muted-foreground">Saves</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">
                          {(product.ctr * 100).toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">CTR</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Age Groups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.demographics.ageGroups.map((group, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{group.group}</span>
                      <Badge variant="outline">
                        {group.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.demographics.genders.map((gender, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{gender.gender}</span>
                      <Badge variant="outline">
                        {gender.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.demographics.locations
                    .slice(0, 5)
                    .map((location, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">{location.location}</span>
                        <Badge variant="outline">
                          {location.percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeframes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Time-based Analysis</CardTitle>
              <CardDescription>
                Understand when your products perform best
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="daily" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="hourly">Hourly</TabsTrigger>
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                </TabsList>

                <TabsContent value="hourly">
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Activity className="h-12 w-12 mx-auto mb-4" />
                      <p>Hourly performance chart</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="daily">
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-4" />
                      <p>Daily performance chart</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="weekly">
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                      <p>Weekly performance chart</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
