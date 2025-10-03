type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  context?: string
  [key: string]: unknown
}

const formatMessage = (level: LogLevel, message: string, context?: LogContext) => {
  if (!context || Object.keys(context).length === 0) {
    return message
  }
  const ctx = { ...context }
  return `${message} ${JSON.stringify(ctx)}`
}

export const logInfo = (message: string, context?: LogContext) => {
  console.log(formatMessage('info', message, context))
}

export const logWarn = (message: string, context?: LogContext) => {
  console.warn(formatMessage('warn', message, context))
}

export const logError = (message: string, context?: LogContext) => {
  console.error(formatMessage('error', message, context))
}

