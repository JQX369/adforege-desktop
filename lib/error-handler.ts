import { NextRequest, NextResponse } from 'next/server'

// Error types and severity levels
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  DATABASE = 'DATABASE',
  EXTERNAL_API = 'EXTERNAL_API',
  NETWORK = 'NETWORK',
  INTERNAL = 'INTERNAL',
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  CONFIGURATION = 'CONFIGURATION',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Error context interface
export interface ErrorContext {
  userId?: string
  sessionId?: string
  requestId?: string
  userAgent?: string
  ip?: string
  url?: string
  method?: string
  timestamp?: Date
  stack?: string
  metadata?: Record<string, any>
}

// Error interface
export interface AppError extends Error {
  type: ErrorType
  severity: ErrorSeverity
  statusCode: number
  context?: ErrorContext
  isOperational: boolean
  retryable: boolean
  userMessage?: string
  technicalMessage?: string
}

// Error logging interface
export interface ErrorLog {
  id: string
  type: ErrorType
  severity: ErrorSeverity
  message: string
  stack?: string
  context: ErrorContext
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

// Error handler class
export class ErrorHandler {
  private static instance: ErrorHandler
  private errorLogs: ErrorLog[] = []
  private maxLogs = 1000

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // Create a new error
  createError(
    type: ErrorType,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: ErrorContext
  ): AppError {
    const error = new Error(message) as AppError
    error.type = type
    error.severity = severity
    error.context = context
    error.isOperational = true
    error.retryable = this.isRetryable(type)
    error.statusCode = this.getStatusCode(type)
    error.userMessage = this.getUserMessage(type, message)
    error.technicalMessage = message

    return error
  }

  // Handle and log errors
  async handleError(
    error: Error | AppError,
    context?: ErrorContext
  ): Promise<void> {
    const appError = this.normalizeError(error, context)

    // Log the error
    await this.logError(appError)

    // Send alerts for critical errors
    if (appError.severity === ErrorSeverity.CRITICAL) {
      await this.sendAlert(appError)
    }

    // Track error metrics
    this.trackErrorMetrics(appError)
  }

  // Normalize error to AppError
  private normalizeError(
    error: Error | AppError,
    context?: ErrorContext
  ): AppError {
    if (this.isAppError(error)) {
      return error
    }

    const appError = this.createError(
      ErrorType.INTERNAL,
      error.message,
      ErrorSeverity.MEDIUM,
      context
    )

    appError.stack = error.stack
    return appError
  }

  // Check if error is AppError
  private isAppError(error: Error): error is AppError {
    return 'type' in error && 'severity' in error
  }

  // Log error to storage
  private async logError(error: AppError): Promise<void> {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      type: error.type,
      severity: error.severity,
      message: error.message,
      stack: error.stack,
      context: error.context || {},
      timestamp: new Date(),
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      retryable: error.retryable,
      userMessage: error.userMessage,
      technicalMessage: error.technicalMessage,
      resolved: false,
    }

    this.errorLogs.unshift(errorLog)

    // Keep only recent logs
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(0, this.maxLogs)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', {
        type: error.type,
        severity: error.severity,
        message: error.message,
        context: error.context,
      })
    }

    // In production, send to external logging service
    if (process.env.NODE_ENV === 'production') {
      await this.sendToExternalLogger(errorLog)
    }
  }

  // Send alert for critical errors
  private async sendAlert(error: AppError): Promise<void> {
    // Implementation would send alerts to monitoring services
    console.warn('Critical error alert:', {
      type: error.type,
      message: error.message,
      context: error.context,
    })
  }

  // Track error metrics
  private trackErrorMetrics(error: AppError): void {
    // Implementation would track error metrics
    console.info('Error metrics tracked:', {
      type: error.type,
      severity: error.severity,
      timestamp: new Date(),
    })
  }

  // Send to external logger
  private async sendToExternalLogger(errorLog: ErrorLog): Promise<void> {
    try {
      // Implementation would send to external logging service
      // For now, just log to console
      console.log('External logging:', errorLog)
    } catch (error) {
      console.error('Failed to send to external logger:', error)
    }
  }

  // Get status code for error type
  private getStatusCode(type: ErrorType): number {
    switch (type) {
      case ErrorType.VALIDATION:
        return 400
      case ErrorType.AUTHENTICATION:
        return 401
      case ErrorType.AUTHORIZATION:
        return 403
      case ErrorType.NOT_FOUND:
        return 404
      case ErrorType.RATE_LIMIT:
        return 429
      case ErrorType.DATABASE:
        return 500
      case ErrorType.EXTERNAL_API:
        return 502
      case ErrorType.NETWORK:
        return 503
      case ErrorType.INTERNAL:
        return 500
      case ErrorType.CLIENT:
        return 400
      case ErrorType.TIMEOUT:
        return 408
      case ErrorType.CONFIGURATION:
        return 500
      default:
        return 500
    }
  }

  // Get user-friendly message
  private getUserMessage(type: ErrorType, message: string): string {
    switch (type) {
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.'
      case ErrorType.AUTHENTICATION:
        return 'Please log in to continue.'
      case ErrorType.AUTHORIZATION:
        return 'You do not have permission to perform this action.'
      case ErrorType.NOT_FOUND:
        return 'The requested resource was not found.'
      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please try again later.'
      case ErrorType.DATABASE:
        return 'A database error occurred. Please try again.'
      case ErrorType.EXTERNAL_API:
        return 'External service is temporarily unavailable.'
      case ErrorType.NETWORK:
        return 'Network error. Please check your connection.'
      case ErrorType.INTERNAL:
        return 'An internal error occurred. Please try again.'
      case ErrorType.CLIENT:
        return 'Invalid request. Please check your input.'
      case ErrorType.TIMEOUT:
        return 'Request timed out. Please try again.'
      case ErrorType.CONFIGURATION:
        return 'Service configuration error. Please contact support.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }

  // Check if error is retryable
  private isRetryable(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.NETWORK:
      case ErrorType.EXTERNAL_API:
      case ErrorType.TIMEOUT:
      case ErrorType.DATABASE:
        return true
      default:
        return false
    }
  }

  // Generate unique ID
  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Get error logs
  getErrorLogs(limit: number = 100): ErrorLog[] {
    return this.errorLogs.slice(0, limit)
  }

  // Get error statistics
  getErrorStatistics(): {
    total: number
    byType: Record<ErrorType, number>
    bySeverity: Record<ErrorSeverity, number>
    recent: number
    critical: number
  } {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    const byType: Record<ErrorType, number> = {} as Record<ErrorType, number>
    const bySeverity: Record<ErrorSeverity, number> = {} as Record<
      ErrorSeverity,
      number
    >

    let recent = 0
    let critical = 0

    for (const log of this.errorLogs) {
      // Count by type
      byType[log.type] = (byType[log.type] || 0) + 1

      // Count by severity
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1

      // Count recent errors
      if (log.timestamp.getTime() > oneHourAgo) {
        recent++
      }

      // Count critical errors
      if (log.severity === ErrorSeverity.CRITICAL) {
        critical++
      }
    }

    return {
      total: this.errorLogs.length,
      byType,
      bySeverity,
      recent,
      critical,
    }
  }

  // Resolve error
  resolveError(errorId: string, resolvedBy: string, notes?: string): boolean {
    const errorLog = this.errorLogs.find((log) => log.id === errorId)
    if (errorLog) {
      errorLog.resolved = true
      errorLog.resolvedAt = new Date()
      errorLog.resolvedBy = resolvedBy
      errorLog.notes = notes
      return true
    }
    return false
  }

  // Clear resolved errors
  clearResolvedErrors(): number {
    const initialLength = this.errorLogs.length
    this.errorLogs = this.errorLogs.filter((log) => !log.resolved)
    return initialLength - this.errorLogs.length
  }
}

// Global error handler instance
export const errorHandler = ErrorHandler.getInstance()

// Utility functions
export function createError(
  type: ErrorType,
  message: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: ErrorContext
): AppError {
  return errorHandler.createError(type, message, severity, context)
}

export async function handleError(
  error: Error | AppError,
  context?: ErrorContext
): Promise<void> {
  return errorHandler.handleError(error, context)
}

// Error boundary for React components
export class ErrorBoundary extends Error {
  constructor(message: string, componentStack?: string) {
    super(message)
    this.name = 'ErrorBoundary'
    this.stack = componentStack
  }
}

// API error response helper
export function createErrorResponse(
  error: AppError,
  request?: NextRequest
): NextResponse {
  const context: ErrorContext = {
    requestId: request?.headers.get('x-request-id') || undefined,
    userAgent: request?.headers.get('user-agent') || undefined,
    ip: request?.headers.get('x-forwarded-for') || undefined,
    url: request?.url,
    method: request?.method,
    timestamp: new Date(),
  }

  return NextResponse.json(
    {
      error: error.userMessage || 'An error occurred',
      type: error.type,
      statusCode: error.statusCode,
      requestId: context.requestId,
      timestamp: context.timestamp?.toISOString(),
    },
    {
      status: error.statusCode,
      headers: {
        'X-Error-Type': error.type,
        'X-Error-Severity': error.severity,
        'X-Request-ID': context.requestId || 'unknown',
      },
    }
  )
}

// Graceful degradation helper
export function withGracefulDegradation<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: ErrorContext
): Promise<T> {
  return operation().catch(async (error) => {
    await handleError(error, context)
    return fallback
  })
}

// Retry helper
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  context?: ErrorContext
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries) {
        break
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay * attempt))
    }
  }

  await handleError(lastError!, context)
  throw lastError!
}
