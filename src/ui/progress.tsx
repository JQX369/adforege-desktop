'use client'

import * as React from 'react'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, max = 100, className = '', style, ...props }, ref) => {
    const percent = Math.max(0, Math.min(100, (value / max) * 100))
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        className={`relative h-2 w-full overflow-hidden rounded bg-gray-200 ${className}`}
        style={style}
        {...props}
      >
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    )
  }
)

Progress.displayName = 'Progress'

export default Progress
