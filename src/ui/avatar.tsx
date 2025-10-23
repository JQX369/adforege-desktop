'use client'

import * as React from 'react'

export interface AvatarProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string
}

export function Avatar({
  src,
  alt = '',
  fallback,
  className = '',
  ...props
}: AvatarProps) {
  const [error, setError] = React.useState(false)
  if (!src || error) {
    const letter = (fallback || (alt || '?').trim()[0] || '?').toUpperCase()
    return (
      <div
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium ${className}`}
      >
        {letter}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`h-8 w-8 rounded-full object-cover ${className}`}
      onError={() => setError(true)}
      {...props}
    />
  )
}

export default Avatar

export const AvatarImage = Avatar
export const AvatarFallback = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium ${className}`}
  >
    {children}
  </div>
)
