'use client'

import * as React from 'react'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  title?: string
  description?: React.ReactNode
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'default',
      title,
      description,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: 'bg-gray-50 border-gray-200 text-gray-900',
      destructive: 'bg-red-50 border-red-200 text-red-900',
      success: 'bg-green-50 border-green-200 text-green-900',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    } as const

    return (
      <div
        ref={ref}
        role="status"
        className={`w-full rounded border p-4 ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {title && <div className="mb-1 font-semibold">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
        {children}
      </div>
    )
  }
)

Alert.displayName = 'Alert'

export default Alert

export const AlertTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 font-semibold">{children}</div>
)
export const AlertDescription = ({
  children,
}: {
  children: React.ReactNode
}) => <div className="text-sm opacity-90">{children}</div>
