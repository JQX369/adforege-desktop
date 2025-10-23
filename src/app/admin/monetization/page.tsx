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
  DollarSign,
  TrendingUp,
  Users,
  ShoppingCart,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

interface RevenueData {
  totalRevenue: number
  revenueByStream: {
    affiliate: number
    subscriptions: number
  }
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
  conversionFunnel: Array<{
    step: string
    count: number
    conversionRate: number
  }>
  revenueTrends: {
    affiliate: { trend: string; rate: number }
    subscriptions: { trend: string; rate: number }
    overall: { trend: string; rate: number }
  }
  topPerformingProducts: Array<{
    productId: string
    revenue: number
    conversions: number
  }>
  revenueForecast: {
    nextMonth: number
    nextQuarter: number
    nextYear: number
    confidence: number
  }
}

interface AffiliateData {
  totalClicks: number
  totalConversions: number
  totalRevenue: number
  totalCommission: number
  programStats: Record<
    string,
    {
      clicks: number
      conversions: number
      revenue: number
      commission: number
      conversionRate: number
    }
  >
}

interface ConversionData {
  totalConversions: number
  conversionValue: number
  conversionRate: number
  abTestResults: Record<
    string,
    Record<
      string,
      {
        conversions: number
        total: number
        conversionRate: number
      }
    >
  >
  funnelAnalysis: {
    steps: Array<{
      step: string
      conversionRate: number
      dropOff: number
      optimization: string
    }>
    overallConversionRate: number
    stepAnalysis: Array<{
      step: string
      conversionRate: number
      dropOff: number
      optimization: string
    }>
  }
  topConvertingPaths: Array<{
    path: string
    conversions: number
  }>
  recommendations: string[]
}

export default function MonetizationDashboard() {
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null)
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null)
  const [conversionData, setConversionData] = useState<ConversionData | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchMonetizationData()
  }, [])

  const fetchMonetizationData = async () => {
    try {
      const [revenueResponse, affiliateResponse, conversionResponse] =
        await Promise.all([
          fetch('/api/monetization/revenue/optimize'),
          fetch('/api/monetization/affiliate/track'),
          fetch('/api/monetization/conversion/optimize'),
        ])

      if (revenueResponse.ok) {
        const revenueResult = await revenueResponse.json()
        setRevenueData(revenueResult.analytics)
      }

      if (affiliateResponse.ok) {
        const affiliateResult = await affiliateResponse.json()
        setAffiliateData(affiliateResult.analytics)
      }

      if (conversionResponse.ok) {
        const conversionResult = await conversionResponse.json()
        setConversionData(conversionResult.analytics)
      }
    } catch (error) {
      console.error('Error fetching monetization data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const getTrendIcon = (trend: string) => {
    return trend === 'increasing' ? (
      <ArrowUpRight className="h-4 w-4 text-green-500" />
    ) : (
      <ArrowDownRight className="h-4 w-4 text-red-500" />
    )
  }

  const getTrendColor = (trend: string) => {
    return trend === 'increasing' ? 'text-green-500' : 'text-red-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Monetization Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor and optimize revenue streams, affiliate performance, and
            conversion rates
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
            <TabsTrigger value="conversion">Conversion</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Revenue
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {revenueData
                      ? formatCurrency(revenueData.totalRevenue)
                      : '$0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {revenueData?.revenueTrends.overall.trend === 'increasing'
                      ? '+'
                      : ''}
                    {revenueData
                      ? formatPercentage(revenueData.revenueTrends.overall.rate)
                      : '0%'}{' '}
                    from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">MRR</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {revenueData
                      ? formatCurrency(revenueData.monthlyRecurringRevenue)
                      : '$0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Monthly recurring revenue
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ARPU</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {revenueData
                      ? formatCurrency(revenueData.averageRevenuePerUser)
                      : '$0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average revenue per user
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Conversion Rate
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {conversionData
                      ? formatPercentage(conversionData.conversionRate)
                      : '0%'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Overall conversion rate
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Streams */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Streams</CardTitle>
                  <CardDescription>
                    Breakdown of revenue by source
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium">
                          Subscriptions
                        </span>
                      </div>
                      <span className="text-sm font-bold">
                        {revenueData
                          ? formatCurrency(
                              revenueData.revenueByStream.subscriptions
                            )
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Affiliate</span>
                      </div>
                      <span className="text-sm font-bold">
                        {revenueData
                          ? formatCurrency(
                              revenueData.revenueByStream.affiliate
                            )
                          : '$0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Forecast</CardTitle>
                  <CardDescription>Projected revenue growth</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Next Month</span>
                      <span className="text-sm font-bold">
                        {revenueData
                          ? formatCurrency(
                              revenueData.revenueForecast.nextMonth
                            )
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Next Quarter</span>
                      <span className="text-sm font-bold">
                        {revenueData
                          ? formatCurrency(
                              revenueData.revenueForecast.nextQuarter
                            )
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Next Year</span>
                      <span className="text-sm font-bold">
                        {revenueData
                          ? formatCurrency(revenueData.revenueForecast.nextYear)
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Confidence</span>
                      <Badge variant="secondary">
                        {revenueData
                          ? formatPercentage(
                              revenueData.revenueForecast.confidence
                            )
                          : '0%'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trends</CardTitle>
                  <CardDescription>
                    Performance across revenue streams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenueData?.revenueTrends &&
                      Object.entries(revenueData.revenueTrends).map(
                        ([stream, trend]) => (
                          <div
                            key={stream}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium capitalize">
                                {stream}
                              </span>
                              {getTrendIcon(trend.trend)}
                            </div>
                            <span
                              className={`text-sm font-bold ${getTrendColor(trend.trend)}`}
                            >
                              {trend.trend === 'increasing' ? '+' : ''}
                              {formatPercentage(trend.rate)}
                            </span>
                          </div>
                        )
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Products</CardTitle>
                  <CardDescription>
                    Highest revenue generating products
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {revenueData?.topPerformingProducts
                      .slice(0, 5)
                      .map((product, index) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">
                              #{index + 1}
                            </span>
                            <span className="text-sm text-gray-600 truncate">
                              {product.productId}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">
                              {formatCurrency(product.revenue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {product.conversions} conversions
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="affiliate" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Affiliate Performance</CardTitle>
                  <CardDescription>
                    Overall affiliate program metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Clicks</span>
                      <span className="text-sm font-bold">
                        {affiliateData
                          ? affiliateData.totalClicks.toLocaleString()
                          : '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Total Conversions
                      </span>
                      <span className="text-sm font-bold">
                        {affiliateData
                          ? affiliateData.totalConversions.toLocaleString()
                          : '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Revenue</span>
                      <span className="text-sm font-bold">
                        {affiliateData
                          ? formatCurrency(affiliateData.totalRevenue)
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Total Commission
                      </span>
                      <span className="text-sm font-bold">
                        {affiliateData
                          ? formatCurrency(affiliateData.totalCommission)
                          : '$0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Program Performance</CardTitle>
                  <CardDescription>
                    Performance by affiliate program
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {affiliateData?.programStats &&
                      Object.entries(affiliateData.programStats).map(
                        ([program, stats]) => (
                          <div
                            key={program}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium capitalize">
                                {program}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold">
                                {formatCurrency(stats.revenue)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatPercentage(stats.conversionRate)}{' '}
                                conversion rate
                              </div>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="conversion" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Funnel</CardTitle>
                  <CardDescription>
                    Step-by-step conversion analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {conversionData?.funnelAnalysis.stepAnalysis.map(
                      (step, index) => (
                        <div
                          key={step.step}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">
                              {step.step}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">
                              {formatPercentage(step.conversionRate)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatPercentage(step.dropOff)} drop-off
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Converting Paths</CardTitle>
                  <CardDescription>
                    Most successful user journeys
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {conversionData?.topConvertingPaths
                      .slice(0, 5)
                      .map((path, index) => (
                        <div
                          key={path.path}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">
                              #{index + 1}
                            </span>
                            <span className="text-sm text-gray-600 truncate">
                              {path.path}
                            </span>
                          </div>
                          <span className="text-sm font-bold">
                            {path.conversions} conversions
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
                <CardDescription>
                  Actionable insights to improve conversions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {conversionData?.recommendations.map(
                    (recommendation, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Zap className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          {recommendation}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 mt-8">
          <Button variant="outline" onClick={fetchMonetizationData}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button>
            <BarChart3 className="h-4 w-4 mr-2" />
            Run Optimization
          </Button>
        </div>
      </div>
    </div>
  )
}
