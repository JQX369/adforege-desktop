import { NextRequest, NextResponse } from 'next/server'
import {
  handleError,
  createError,
  createErrorResponse,
  ErrorType,
  ErrorSeverity,
  ErrorContext,
} from '@/lib/error-handler'

// API error handler wrapper - supports both regular and dynamic route handlers
export function withErrorHandling<T extends { params?: { [key: string]: string } }>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>,
  options: {
    operationName?: string
    logErrors?: boolean
    includeStack?: boolean
  } = {}
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    const {
      operationName = 'API Operation',
      logErrors = true,
      includeStack = false,
    } = options

    try {
      return await handler(req, context)
    } catch (error) {
      const errorContext: ErrorContext = {
        requestId: req.headers.get('x-request-id') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        ip:
          req.headers.get('x-forwarded-for') ||
          req.headers.get('x-real-ip') ||
          undefined,
        url: req.url,
        method: req.method,
        timestamp: new Date(),
        metadata: {
          operationName,
          includeStack,
          ...(context?.params && { params: context.params }),
        },
      }

      if (logErrors) {
        await handleError(error as Error, errorContext)
      }

      // Determine error type and severity
      let errorType = ErrorType.INTERNAL
      let severity = ErrorSeverity.MEDIUM

      if (error instanceof Error) {
        if (error.message.includes('validation')) {
          errorType = ErrorType.VALIDATION
          severity = ErrorSeverity.LOW
        } else if (error.message.includes('unauthorized')) {
          errorType = ErrorType.AUTHENTICATION
          severity = ErrorSeverity.MEDIUM
        } else if (error.message.includes('forbidden')) {
          errorType = ErrorType.AUTHORIZATION
          severity = ErrorSeverity.MEDIUM
        } else if (error.message.includes('not found')) {
          errorType = ErrorType.NOT_FOUND
          severity = ErrorSeverity.LOW
        } else if (error.message.includes('rate limit')) {
          errorType = ErrorType.RATE_LIMIT
          severity = ErrorSeverity.MEDIUM
        } else if (error.message.includes('database')) {
          errorType = ErrorType.DATABASE
          severity = ErrorSeverity.HIGH
        } else if (error.message.includes('timeout')) {
          errorType = ErrorType.TIMEOUT
          severity = ErrorSeverity.MEDIUM
        } else if (error.message.includes('network')) {
          errorType = ErrorType.NETWORK
          severity = ErrorSeverity.MEDIUM
        }
      }

      const appError = createError(
        errorType,
        error instanceof Error ? error.message : 'Unknown error',
        severity,
        errorContext
      )

      return createErrorResponse(appError, req)
    }
  }
}

// Specific error handlers for common scenarios
export class ApiErrorHandler {
  // Handle validation errors
  static validationError(
    message: string,
    details?: Record<string, any>
  ): NextResponse {
    const error = createError(
      ErrorType.VALIDATION,
      message,
      ErrorSeverity.LOW,
      { metadata: { details } }
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        details: details,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    )
  }

  // Handle authentication errors
  static authenticationError(
    message: string = 'Authentication required'
  ): NextResponse {
    const error = createError(
      ErrorType.AUTHENTICATION,
      message,
      ErrorSeverity.MEDIUM
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    )
  }

  // Handle authorization errors
  static authorizationError(
    message: string = 'Insufficient permissions'
  ): NextResponse {
    const error = createError(
      ErrorType.AUTHORIZATION,
      message,
      ErrorSeverity.MEDIUM
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    )
  }

  // Handle not found errors
  static notFoundError(resource: string = 'Resource'): NextResponse {
    const error = createError(
      ErrorType.NOT_FOUND,
      `${resource} not found`,
      ErrorSeverity.LOW
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    )
  }

  // Handle rate limit errors
  static rateLimitError(retryAfter?: number): NextResponse {
    const error = createError(
      ErrorType.RATE_LIMIT,
      'Rate limit exceeded',
      ErrorSeverity.MEDIUM
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
        retryAfter,
      },
      {
        status: error.statusCode,
        headers: {
          'Retry-After': retryAfter?.toString() || '60',
        },
      }
    )
  }

  // Handle database errors
  static databaseError(message: string = 'Database error'): NextResponse {
    const error = createError(ErrorType.DATABASE, message, ErrorSeverity.HIGH)

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    )
  }

  // Handle external API errors
  static externalApiError(service: string, message: string): NextResponse {
    const error = createError(
      ErrorType.EXTERNAL_API,
      `${service} API error: ${message}`,
      ErrorSeverity.HIGH,
      { metadata: { service } }
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
        service,
      },
      { status: error.statusCode }
    )
  }

  // Handle timeout errors
  static timeoutError(operation: string): NextResponse {
    const error = createError(
      ErrorType.TIMEOUT,
      `${operation} timed out`,
      ErrorSeverity.MEDIUM,
      { metadata: { operation } }
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
        operation,
      },
      { status: error.statusCode }
    )
  }

  // Handle configuration errors
  static configurationError(message: string): NextResponse {
    const error = createError(
      ErrorType.CONFIGURATION,
      message,
      ErrorSeverity.CRITICAL
    )

    return NextResponse.json(
      {
        error: error.userMessage,
        type: error.type,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    )
  }
}

// Utility function to check if error is operational
export function isOperationalError(error: Error): boolean {
  return 'isOperational' in error && (error as any).isOperational === true
}

// Utility function to get error context from request
export function getErrorContextFromRequest(req: NextRequest): ErrorContext {
  return {
    requestId: req.headers.get('x-request-id') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
    ip:
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      undefined,
    url: req.url,
    method: req.method,
    timestamp: new Date(),
  }
}

// Utility function to sanitize error messages for production
export function sanitizeErrorMessage(
  message: string,
  isProduction: boolean = false
): string {
  if (!isProduction) {
    return message
  }

  // Remove sensitive information from error messages
  return message
    .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***')
    .replace(/password[=:]\s*[^\s]+/gi, 'password=***')
    .replace(/token[=:]\s*[^\s]+/gi, 'token=***')
    .replace(/key[=:]\s*[^\s]+/gi, 'key=***')
    .replace(/secret[=:]\s*[^\s]+/gi, 'secret=***')
}

// Error response formatter
export function formatErrorResponse(
  error: Error,
  req: NextRequest,
  includeStack: boolean = false
): NextResponse {
  const context = getErrorContextFromRequest(req)
  const isProduction = process.env.NODE_ENV === 'production'

  const sanitizedMessage = sanitizeErrorMessage(error.message, isProduction)

  return NextResponse.json(
    {
      error: sanitizedMessage,
      type: 'INTERNAL',
      statusCode: 500,
      requestId: context.requestId,
      timestamp: context.timestamp?.toISOString(),
      ...(includeStack && !isProduction && { stack: error.stack }),
    },
    {
      status: 500,
      headers: {
        'X-Error-Type': 'INTERNAL',
        'X-Error-Severity': 'MEDIUM',
        'X-Request-ID': context.requestId || 'unknown',
      },
    }
  )
}
