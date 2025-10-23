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
import { Input } from '@/src/ui/input'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Users,
  Eye,
  MousePointer,
  TrendingUp,
  DollarSign,
  Clock,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  Target,
  Activity,
} from 'lucide-react'

interface AnalyticsData {
  overview: {
    totalUsers: number
    totalSessions: number
    totalPageViews: number
    totalConversions: number
    conversionRate: number
    averageSessionDuration: number
    bounceRate: number
    revenue: number
  }
  pageViews: Array<{
    page: string
    views: number
    uniqueViews: number
    avgTimeOnPage: number
  }>
  userBehavior: Array<{
    event: string
    count: number
    uniqueUsers: number
    avgValue: number
  }>
  conversions: Array<{
    type: string
    count: number
    value: number
    conversionRate: number
  }>
  traffic: Array<{
    source: string
    visitors: number
    sessions: number
    conversions: number
  }>
  deviceBreakdown: Array<{
    device: string
    count: number
    percentage: number
  }>
  timeSeries: Array<{
    date: string
    users: number
    sessions: number
    pageViews: number
    conversions: number
  }>
}

interface ABTestData {
  tests: Array<{
    id: string
    name: string
    status: string
    variants: number
    participants: number
    conversionRate: number
    statisticalSignificance: number
  }>
}

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [abTestData, setAbTestData] = useState<ABTestData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7d')
  const [selectedMetric, setSelectedMetric] = useState('pageViews')

  const fetchAnalyticsData = async () => {
    setIsLoading(true)

    try {
      // Simulate API calls (in production, these would be real endpoints)
      const overviewResponse = await fetch(
        `/api/admin/analytics/overview?range=${dateRange}`
      )
      const pageViewsResponse = await fetch(
        `/api/admin/analytics/page-views?range=${dateRange}`
      )
      const behaviorResponse = await fetch(
        `/api/admin/analytics/behavior?range=${dateRange}`
      )
      const conversionsResponse = await fetch(
        `/api/admin/analytics/conversions?range=${dateRange}`
      )
      const trafficResponse = await fetch(
        `/api/admin/analytics/traffic?range=${dateRange}`
      )
      const devicesResponse = await fetch(
        `/api/admin/analytics/devices?range=${dateRange}`
      )
      const timeSeriesResponse = await fetch(
        `/api/admin/analytics/time-series?range=${dateRange}`
      )

      // Mock data for demonstration
      const mockData: AnalyticsData = {
        overview: {
          totalUsers: 15420,
          totalSessions: 18750,
          totalPageViews: 45680,
          totalConversions: 3420,
          conversionRate: 18.2,
          averageSessionDuration: 245,
          bounceRate: 32.5,
          revenue: 45680.5,
        },
        pageViews: [
          { page: '/', views: 12500, uniqueViews: 8900, avgTimeOnPage: 45 },
          {
            page: '/gift-guides',
            views: 8900,
            uniqueViews: 6700,
            avgTimeOnPage: 120,
          },
          {
            page: '/vendor',
            views: 3200,
            uniqueViews: 2800,
            avgTimeOnPage: 180,
          },
          { page: '/about', views: 2100, uniqueViews: 1900, avgTimeOnPage: 90 },
          {
            page: '/gift-guides/christmas',
            views: 1800,
            uniqueViews: 1500,
            avgTimeOnPage: 150,
          },
        ],
        userBehavior: [
          { event: 'page_view', count: 45680, uniqueUsers: 15420, avgValue: 0 },
          { event: 'click', count: 23450, uniqueUsers: 12300, avgValue: 0 },
          { event: 'form_submit', count: 8900, uniqueUsers: 6700, avgValue: 0 },
          { event: 'search', count: 5600, uniqueUsers: 4200, avgValue: 0 },
          { event: 'scroll', count: 34500, uniqueUsers: 13800, avgValue: 0 },
          { event: 'hover', count: 18900, uniqueUsers: 9800, avgValue: 0 },
        ],
        conversions: [
          {
            type: 'recommendation',
            count: 2800,
            value: 0,
            conversionRate: 18.2,
          },
          {
            type: 'affiliate_click',
            count: 1200,
            value: 45680.5,
            conversionRate: 7.8,
          },
          { type: 'vendor_signup', count: 45, value: 0, conversionRate: 0.3 },
          {
            type: 'form_completion',
            count: 8900,
            value: 0,
            conversionRate: 58.1,
          },
        ],
        traffic: [
          {
            source: 'Direct',
            visitors: 8900,
            sessions: 10200,
            conversions: 1800,
          },
          {
            source: 'Google',
            visitors: 4500,
            sessions: 5200,
            conversions: 950,
          },
          {
            source: 'Social Media',
            visitors: 1200,
            sessions: 1400,
            conversions: 280,
          },
          {
            source: 'Referral',
            visitors: 800,
            sessions: 950,
            conversions: 180,
          },
          { source: 'Email', visitors: 20, sessions: 25, conversions: 5 },
        ],
        deviceBreakdown: [
          { device: 'Desktop', count: 8900, percentage: 57.7 },
          { device: 'Mobile', count: 5200, percentage: 33.7 },
          { device: 'Tablet', count: 1320, percentage: 8.6 },
        ],
        timeSeries: [
          {
            date: '2024-01-01',
            users: 1200,
            sessions: 1450,
            pageViews: 3200,
            conversions: 280,
          },
          {
            date: '2024-01-02',
            users: 1350,
            sessions: 1620,
            pageViews: 3800,
            conversions: 320,
          },
          {
            date: '2024-01-03',
            users: 1100,
            sessions: 1320,
            pageViews: 2900,
            conversions: 250,
          },
          {
            date: '2024-01-04',
            users: 1400,
            sessions: 1680,
            pageViews: 4200,
            conversions: 380,
          },
          {
            date: '2024-01-05',
            users: 1600,
            sessions: 1920,
            pageViews: 4800,
            conversions: 420,
          },
          {
            date: '2024-01-06',
            users: 1800,
            sessions: 2160,
            pageViews: 5400,
            conversions: 480,
          },
          {
            date: '2024-01-07',
            users: 2000,
            sessions: 2400,
            pageViews: 6000,
            conversions: 520,
          },
        ],
      }

      setAnalyticsData(mockData)
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchABTestData = async () => {
    try {
      // Mock A/B test data
      const mockABTestData: ABTestData = {
        tests: [
          {
            id: 'test_1',
            name: 'Hero CTA Button Color',
            status: 'active',
            variants: 2,
            participants: 15420,
            conversionRate: 18.2,
            statisticalSignificance: 95.5,
          },
          {
            id: 'test_2',
            name: 'Gift Form Layout',
            status: 'completed',
            variants: 3,
            participants: 8900,
            conversionRate: 22.1,
            statisticalSignificance: 98.2,
          },
          {
            id: 'test_3',
            name: 'Product Card Design',
            status: 'paused',
            variants: 2,
            participants: 5600,
            conversionRate: 15.8,
            statisticalSignificance: 87.3,
          },
        ],
      }

      setAbTestData(mockABTestData)
    } catch (error) {
      console.error('Failed to fetch A/B test data:', error)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
    fetchABTestData()
  }, [dateRange])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Track user behavior, conversions, and A/B test performance
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1 Day</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchAnalyticsData} disabled={isLoading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
          <TabsTrigger value="traffic">Traffic Sources</TabsTrigger>
          <TabsTrigger value="ab-tests">A/B Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Metrics */}
          {analyticsData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsData.overview.totalUsers.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +12% from last period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Page Views
                  </CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsData.overview.totalPageViews.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +8% from last period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Conversion Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsData.overview.conversionRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +2.1% from last period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    £{analyticsData.overview.revenue.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +15% from last period
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Time Series Chart */}
          {analyticsData && (
            <Card>
              <CardHeader>
                <CardTitle>Traffic Over Time</CardTitle>
                <CardDescription>
                  Daily users, sessions, and page views
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="users"
                      stroke="#8884d8"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="sessions"
                      stroke="#82ca9d"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="pageViews"
                      stroke="#ffc658"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Device Breakdown */}
          {analyticsData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Device Breakdown</CardTitle>
                  <CardDescription>User devices and platforms</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={analyticsData.deviceBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ device, percentage }) =>
                          `${device} (${percentage}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {analyticsData.deviceBreakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Pages</CardTitle>
                  <CardDescription>Most visited pages</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.pageViews.slice(0, 5).map((page, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <span className="text-sm font-medium">
                            {page.page}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">
                            {page.views.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {page.uniqueViews.toLocaleString()} unique
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          {analyticsData && (
            <Card>
              <CardHeader>
                <CardTitle>User Behavior Events</CardTitle>
                <CardDescription>
                  Track user interactions and engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.userBehavior}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="event" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="conversions" className="space-y-6">
          {analyticsData && (
            <Card>
              <CardHeader>
                <CardTitle>Conversion Metrics</CardTitle>
                <CardDescription>
                  Track different types of conversions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.conversions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="traffic" className="space-y-6">
          {analyticsData && (
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
                <CardDescription>Where your visitors come from</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.traffic}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="visitors" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ab-tests" className="space-y-6">
          {abTestData && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">A/B Tests</h2>
                <Button>
                  <Target className="h-4 w-4 mr-2" />
                  Create Test
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {abTestData.tests.map((test) => (
                  <Card key={test.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{test.name}</CardTitle>
                        <Badge
                          variant={
                            test.status === 'active' ? 'default' : 'secondary'
                          }
                        >
                          {test.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Participants
                          </span>
                          <span className="text-sm font-medium">
                            {test.participants.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Variants
                          </span>
                          <span className="text-sm font-medium">
                            {test.variants}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Conversion Rate
                          </span>
                          <span className="text-sm font-medium">
                            {test.conversionRate}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Significance
                          </span>
                          <span className="text-sm font-medium">
                            {test.statisticalSignificance}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
