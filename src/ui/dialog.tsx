'use client'

import * as React from 'react'

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = React.useState(!!open)
  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open)
  }, [open])
  const close = () => {
    setIsOpen(false)
    onOpenChange?.(false)
  }
  if (!isOpen) return null
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative z-10 w-full max-w-lg rounded bg-white p-4 shadow-lg">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export function DialogHeader({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`mb-2 ${className}`}>{children}</div>
}

export function DialogTitle({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>
}

export function DialogDescription({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={`text-sm text-gray-600 ${className}`}>{children}</p>
}

export default Dialog

export const DialogTrigger = ({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) => (
  <button type="button" onClick={onClick}>
    {children}
  </button>
)
