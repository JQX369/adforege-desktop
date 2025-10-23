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
  Brain,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Activity,
  Settings,
  Download,
  Upload,
} from 'lucide-react'

interface MLDashboardProps {}

interface ModelStatus {
  name: string
  status: 'training' | 'ready' | 'error' | 'idle'
  accuracy: number
  lastTrained: string
  trainingTime: number
  dataSize: number
}

interface PerformanceMetrics {
  recommendationEngine: {
    accuracy: number
    clickThroughRate: number
    conversionRate: number
    diversityScore: number
  }
  behaviorAnalyzer: {
    predictionAccuracy: number
    segmentAccuracy: number
    userTypeAccuracy: number
  }
  nicheDetector: {
    nicheDetectionAccuracy: number
    nicheCoverage: number
    nicheGrowthPrediction: number
  }
  personalizationEngine: {
    personalizationAccuracy: number
    userSatisfaction: number
    retentionImprovement: number
  }
}

interface NicheInsights {
  totalNiches: number
  topNiches: Array<{
    name: string
    description: string
    productCount: number
    avgPrice: number
    growthRate: number
  }>
}

export default function MLDashboard({}: MLDashboardProps) {
  const [models, setModels] = useState<ModelStatus[]>([])
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(
    null
  )
  const [nicheInsights, setNicheInsights] = useState<NicheInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<
    'idle' | 'training' | 'completed' | 'error'
  >('idle')

  useEffect(() => {
    fetchMLData()
  }, [])

  const fetchMLData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch model status
      const modelsResponse = await fetch('/api/admin/ml/models')
      const modelsData = await modelsResponse.json()
      setModels(modelsData.models || [])

      // Fetch performance metrics
      const performanceResponse = await fetch('/api/admin/ml/performance')
      const performanceData = await performanceResponse.json()
      setPerformance(performanceData.performance || null)

      // Fetch niche insights
      const nicheResponse = await fetch('/api/admin/ml/niches')
      const nicheData = await nicheResponse.json()
      setNicheInsights(nicheData.niches || null)
    } catch (err) {
      setError('Failed to load ML dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const startTraining = async () => {
    setTrainingStatus('training')
    try {
      const response = await fetch('/api/admin/ml/train', { method: 'POST' })
      if (response.ok) {
        setTrainingStatus('completed')
        await fetchMLData() // Refresh data
      } else {
        setTrainingStatus('error')
      }
    } catch (error) {
      setTrainingStatus('error')
    }
  }

  const updateNicheProfiles = async () => {
    try {
      await fetch('/api/admin/ml/update-niches', { method: 'POST' })
      await fetchMLData() // Refresh data
    } catch (error) {
      console.error('Failed to update niche profiles:', error)
    }
  }

  const cleanupOldData = async () => {
    try {
      await fetch('/api/admin/ml/cleanup', { method: 'POST' })
      await fetchMLData() // Refresh data
    } catch (error) {
      console.error('Failed to cleanup old data:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-600'
      case 'training':
        return 'text-blue-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4" />
      case 'training':
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'error':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ML Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage machine learning models
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchMLData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={startTraining}
            disabled={trainingStatus === 'training'}
          >
            {trainingStatus === 'training' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {trainingStatus === 'training' ? 'Training...' : 'Start Training'}
          </Button>
        </div>
      </div>

      {/* Training Status */}
      {trainingStatus !== 'idle' && (
        <Alert variant={trainingStatus === 'error' ? 'destructive' : 'default'}>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            {trainingStatus === 'training' && 'Training models in progress...'}
            {trainingStatus === 'completed' &&
              'Model training completed successfully!'}
            {trainingStatus === 'error' &&
              'Model training failed. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Model Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {models.map((model) => (
          <Card key={model.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {model.name}
              </CardTitle>
              <div
                className={`flex items-center ${getStatusColor(model.status)}`}
              >
                {getStatusIcon(model.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(model.accuracy * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Last trained: {new Date(model.lastTrained).toLocaleDateString()}
              </p>
              <div className="mt-2">
                <Progress value={model.accuracy * 100} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="niches">Niche Insights</TabsTrigger>
          <TabsTrigger value="models">Model Details</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {performance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Recommendation Engine
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Accuracy
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.recommendationEngine.accuracy * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">CTR</div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.recommendationEngine.clickThroughRate *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Conversion
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.recommendationEngine.conversionRate * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Diversity
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.recommendationEngine.diversityScore * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Behavior Analyzer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Prediction Accuracy
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.behaviorAnalyzer.predictionAccuracy * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Segment Accuracy
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.behaviorAnalyzer.segmentAccuracy * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        User Type Accuracy
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.behaviorAnalyzer.userTypeAccuracy * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Niche Detector
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Detection Accuracy
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.nicheDetector.nicheDetectionAccuracy * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Coverage
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.nicheDetector.nicheCoverage * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Growth Prediction
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.nicheDetector.nicheGrowthPrediction * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Personalization Engine
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Accuracy
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.personalizationEngine
                            .personalizationAccuracy * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        User Satisfaction
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.personalizationEngine.userSatisfaction *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Retention Improvement
                      </div>
                      <div className="text-2xl font-bold">
                        {(
                          performance.personalizationEngine
                            .retentionImprovement * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="niches" className="space-y-4">
          {nicheInsights && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Niche Overview</CardTitle>
                  <CardDescription>
                    Total niches detected: {nicheInsights.totalNiches}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nicheInsights.topNiches.map((niche, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {niche.name}
                          </CardTitle>
                          <CardDescription>{niche.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Products
                              </span>
                              <span className="font-medium">
                                {niche.productCount}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Avg Price
                              </span>
                              <span className="font-medium">
                                ${niche.avgPrice.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Growth Rate
                              </span>
                              <span className="font-medium">
                                {(niche.growthRate * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {models.map((model) => (
              <Card key={model.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{model.name}</span>
                    <Badge
                      variant={
                        model.status === 'ready' ? 'default' : 'secondary'
                      }
                    >
                      {model.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Accuracy
                      </div>
                      <div className="text-xl font-bold">
                        {(model.accuracy * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Training Time
                      </div>
                      <div className="text-xl font-bold">
                        {model.trainingTime}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Data Size
                      </div>
                      <div className="text-xl font-bold">
                        {model.dataSize.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Last Trained
                      </div>
                      <div className="text-xl font-bold">
                        {new Date(model.lastTrained).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Model Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={startTraining}
                  disabled={trainingStatus === 'training'}
                  className="w-full"
                >
                  {trainingStatus === 'training' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Train All Models
                </Button>
                <Button
                  onClick={updateNicheProfiles}
                  variant="outline"
                  className="w-full"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Update Niche Profiles
                </Button>
                <Button
                  onClick={cleanupOldData}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Cleanup Old Data
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Data Export
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export Training Data
                </Button>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export Performance Metrics
                </Button>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export Niche Insights
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
