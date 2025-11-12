// A/B Testing system for feature experiments and optimization

export interface ABTest {
  id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  startDate: Date
  endDate?: Date
  variants: ABTestVariant[]
  targetAudience?: ABTestAudience
  metrics: ABTestMetric[]
  createdAt: Date
  updatedAt: Date
}

export interface ABTestVariant {
  id: string
  name: string
  description: string
  weight: number // 0-1, sum should be 1
  config: Record<string, any>
  isControl: boolean
}

export interface ABTestAudience {
  percentage: number // 0-100
  conditions?: ABTestCondition[]
  excludeConditions?: ABTestCondition[]
}

export interface ABTestCondition {
  type: 'user_property' | 'session_property' | 'page' | 'device' | 'location'
  property: string
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'greater_than'
    | 'less_than'
    | 'in'
    | 'not_in'
  value: any
}

export interface ABTestMetric {
  name: string
  type: 'conversion' | 'engagement' | 'revenue' | 'custom'
  goal: 'increase' | 'decrease' | 'neutral'
  weight: number
  events: string[]
}

export interface ABTestAssignment {
  testId: string
  variantId: string
  userId?: string
  sessionId: string
  assignedAt: Date
  expiresAt?: Date
}

export interface ABTestResult {
  testId: string
  variantId: string
  metric: string
  value: number
  timestamp: Date
  userId?: string
  sessionId: string
}

class ABTestingManager {
  private static instance: ABTestingManager
  private tests: Map<string, ABTest> = new Map()
  private assignments: Map<string, ABTestAssignment> = new Map()
  private results: ABTestResult[] = []

  constructor() {
    this.loadTests()
  }

  static getInstance(): ABTestingManager {
    if (!ABTestingManager.instance) {
      ABTestingManager.instance = new ABTestingManager()
    }
    return ABTestingManager.instance
  }

  // Create a new A/B test
  createTest(test: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>): ABTest {
    const newTest: ABTest = {
      ...test,
      id: this.generateTestId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.tests.set(newTest.id, newTest)
    this.saveTests()

    return newTest
  }

  // Get all tests
  getTests(): ABTest[] {
    return Array.from(this.tests.values())
  }

  // Get active tests
  getActiveTests(): ABTest[] {
    return Array.from(this.tests.values()).filter(
      (test) => test.status === 'active'
    )
  }

  // Get test by ID
  getTest(testId: string): ABTest | undefined {
    return this.tests.get(testId)
  }

  // Update test
  updateTest(testId: string, updates: Partial<ABTest>): ABTest | null {
    const test = this.tests.get(testId)
    if (!test) return null

    const updatedTest = {
      ...test,
      ...updates,
      updatedAt: new Date(),
    }

    this.tests.set(testId, updatedTest)
    this.saveTests()

    return updatedTest
  }

  // Delete test
  deleteTest(testId: string): boolean {
    const deleted = this.tests.delete(testId)
    if (deleted) {
      this.saveTests()
    }
    return deleted
  }

  // Assign user to test variant
  assignToTest(
    testId: string,
    userId?: string,
    sessionId?: string
  ): ABTestAssignment | null {
    const test = this.tests.get(testId)
    if (!test || test.status !== 'active') return null

    const assignmentKey = `${testId}_${userId || sessionId}`

    // Check if already assigned
    if (this.assignments.has(assignmentKey)) {
      return this.assignments.get(assignmentKey)!
    }

    // Check if user meets audience criteria
    if (!this.isUserInAudience(test, userId, sessionId)) {
      return null
    }

    // Assign to variant based on weight
    const variant = this.selectVariant(test.variants)
    if (!variant) return null

    const assignment: ABTestAssignment = {
      testId,
      variantId: variant.id,
      userId,
      sessionId: sessionId || this.generateSessionId(),
      assignedAt: new Date(),
      expiresAt: test.endDate,
    }

    this.assignments.set(assignmentKey, assignment)
    this.saveAssignments()

    return assignment
  }

  // Get user's variant for a test
  getVariant(
    testId: string,
    userId?: string,
    sessionId?: string
  ): ABTestAssignment | null {
    const assignmentKey = `${testId}_${userId || sessionId}`
    return this.assignments.get(assignmentKey) || null
  }

  // Record test result
  recordResult(result: Omit<ABTestResult, 'timestamp'>): void {
    const newResult: ABTestResult = {
      ...result,
      timestamp: new Date(),
    }

    this.results.push(newResult)
    this.saveResults()
  }

  // Get test results
  getTestResults(testId: string): ABTestResult[] {
    return this.results.filter((result) => result.testId === testId)
  }

  // Get test statistics
  getTestStatistics(testId: string): {
    test: ABTest
    variants: {
      variantId: string
      name: string
      assignments: number
      results: number
      metrics: Record<
        string,
        {
          total: number
          average: number
          count: number
        }
      >
    }[]
    overall: {
      totalAssignments: number
      totalResults: number
      conversionRate: number
      statisticalSignificance: number
    }
  } | null {
    const test = this.tests.get(testId)
    if (!test) return null

    const assignments = Array.from(this.assignments.values()).filter(
      (a) => a.testId === testId
    )
    const results = this.results.filter((r) => r.testId === testId)

    const variantStats = test.variants.map((variant) => {
      const variantAssignments = assignments.filter(
        (a) => a.variantId === variant.id
      )
      const variantResults = results.filter((r) => r.variantId === variant.id)

      const metrics: Record<
        string,
        { total: number; average: number; count: number }
      > = {}

      for (const metric of test.metrics) {
        const metricResults = variantResults.filter(
          (r) => r.metric === metric.name
        )
        const values = metricResults.map((r) => r.value)

        metrics[metric.name] = {
          total: values.reduce((sum, val) => sum + val, 0),
          average:
            values.length > 0
              ? values.reduce((sum, val) => sum + val, 0) / values.length
              : 0,
          count: values.length,
        }
      }

      return {
        variantId: variant.id,
        name: variant.name,
        assignments: variantAssignments.length,
        results: variantResults.length,
        metrics,
      }
    })

    const totalAssignments = assignments.length
    const totalResults = results.length
    const conversionRate =
      totalAssignments > 0 ? totalResults / totalAssignments : 0
    const statisticalSignificance = this.calculateStatisticalSignificance(
      test,
      results
    )

    return {
      test,
      variants: variantStats,
      overall: {
        totalAssignments,
        totalResults,
        conversionRate,
        statisticalSignificance,
      },
    }
  }

  // Check if user meets audience criteria
  private isUserInAudience(
    test: ABTest,
    userId?: string,
    sessionId?: string
  ): boolean {
    if (!test.targetAudience) return true

    const { percentage, conditions, excludeConditions } = test.targetAudience

    // Check percentage
    const hash = this.hashString(userId || sessionId || 'anonymous')
    if (hash % 100 >= percentage) return false

    // Check exclude conditions
    if (excludeConditions) {
      for (const condition of excludeConditions) {
        if (this.evaluateCondition(condition, userId, sessionId)) {
          return false
        }
      }
    }

    // Check include conditions
    if (conditions) {
      for (const condition of conditions) {
        if (!this.evaluateCondition(condition, userId, sessionId)) {
          return false
        }
      }
    }

    return true
  }

  // Evaluate condition
  private evaluateCondition(
    condition: ABTestCondition,
    userId?: string,
    sessionId?: string
  ): boolean {
    // Implementation would evaluate conditions based on user properties, session data, etc.
    // For now, return true as a placeholder
    return true
  }

  // Select variant based on weight
  private selectVariant(variants: ABTestVariant[]): ABTestVariant | null {
    const random = Math.random()
    let cumulativeWeight = 0

    for (const variant of variants) {
      cumulativeWeight += variant.weight
      if (random <= cumulativeWeight) {
        return variant
      }
    }

    return variants[0] || null
  }

  // Calculate statistical significance
  private calculateStatisticalSignificance(
    test: ABTest,
    results: ABTestResult[]
  ): number {
    // Simplified statistical significance calculation
    // In production, this would use proper statistical methods
    const variantResults = new Map<string, ABTestResult[]>()

    for (const result of results) {
      if (!variantResults.has(result.variantId)) {
        variantResults.set(result.variantId, [])
      }
      variantResults.get(result.variantId)!.push(result)
    }

    if (variantResults.size < 2) return 0

    const variantStats = Array.from(variantResults.entries()).map(
      ([variantId, results]) => {
        const values = results.map((r) => r.value)
        return {
          variantId,
          count: values.length,
          mean: values.reduce((sum, val) => sum + val, 0) / values.length,
          variance: this.calculateVariance(values),
        }
      }
    )

    // Calculate t-test or chi-square test
    // For now, return a placeholder value
    return 0.85
  }

  // Calculate variance
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  }

  // Hash string for consistent assignment
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  // Generate test ID
  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Generate session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Load tests from storage
  private loadTests(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('ab_tests')
        if (stored) {
          const tests = JSON.parse(stored)
          for (const test of tests) {
            this.tests.set(test.id, test)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load A/B tests:', error)
    }
  }

  // Save tests to storage
  private saveTests(): void {
    try {
      if (typeof window !== 'undefined') {
        const tests = Array.from(this.tests.values())
        localStorage.setItem('ab_tests', JSON.stringify(tests))
      }
    } catch (error) {
      console.error('Failed to save A/B tests:', error)
    }
  }

  // Save assignments to storage
  private saveAssignments(): void {
    try {
      if (typeof window !== 'undefined') {
        const assignments = Array.from(this.assignments.values())
        localStorage.setItem('ab_assignments', JSON.stringify(assignments))
      }
    } catch (error) {
      console.error('Failed to save A/B test assignments:', error)
    }
  }

  // Save results to storage
  private saveResults(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ab_results', JSON.stringify(this.results))
      }
    } catch (error) {
      console.error('Failed to save A/B test results:', error)
    }
  }
}

// Global A/B testing manager instance
export const abTestingManager = ABTestingManager.getInstance()

// Utility functions
export function createABTest(
  test: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>
): ABTest {
  return abTestingManager.createTest(test)
}

export function getABTest(testId: string): ABTest | undefined {
  return abTestingManager.getTest(testId)
}

export function getActiveABTests(): ABTest[] {
  return abTestingManager.getActiveTests()
}

export function assignToABTest(
  testId: string,
  userId?: string,
  sessionId?: string
): ABTestAssignment | null {
  return abTestingManager.assignToTest(testId, userId, sessionId)
}

export function getABTestVariant(
  testId: string,
  userId?: string,
  sessionId?: string
): ABTestAssignment | null {
  return abTestingManager.getVariant(testId, userId, sessionId)
}

export function recordABTestResult(
  result: Omit<ABTestResult, 'timestamp'>
): void {
  abTestingManager.recordResult(result)
}

export function getABTestStatistics(testId: string) {
  return abTestingManager.getTestStatistics(testId)
}

// React hook for A/B testing
export function useABTest(testId: string, userId?: string, sessionId?: string) {
  const assignment = getABTestVariant(testId, userId, sessionId)
  const test = getABTest(testId)

  const recordResult = (metric: string, value: number) => {
    if (assignment) {
      recordABTestResult({
        testId,
        variantId: assignment.variantId,
        metric,
        value,
        userId,
        sessionId: assignment.sessionId,
      })
    }
  }

  return {
    test,
    assignment,
    variant: assignment
      ? test?.variants.find((v) => v.id === assignment.variantId)
      : null,
    isAssigned: !!assignment,
    recordResult,
  }
}
