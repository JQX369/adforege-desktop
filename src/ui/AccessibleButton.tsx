'use client'

import { forwardRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { announceToScreenReader } from '@/lib/accessibility'

interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  loading?: boolean
  announceOnClick?: boolean
  announceMessage?: string
  ariaDescribedBy?: string
  ariaExpanded?: boolean
  ariaControls?: string
  ariaPressed?: boolean
  ariaCurrent?: boolean | 'page' | 'step' | 'location' | 'date' | 'time'
}

export const AccessibleButton = forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps
>(
  (
    {
      children,
      className,
      variant = 'default',
      size = 'default',
      loading = false,
      announceOnClick = false,
      announceMessage,
      ariaDescribedBy,
      ariaExpanded,
      ariaControls,
      ariaPressed,
      ariaCurrent,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (announceOnClick && announceMessage) {
        announceToScreenReader(announceMessage)
      }
      onClick?.(e)
    }

    const getVariantClasses = () => {
      switch (variant) {
        case 'destructive':
          return 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive'
        case 'outline':
          return 'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus:ring-ring'
        case 'secondary':
          return 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-ring'
        case 'ghost':
          return 'hover:bg-accent hover:text-accent-foreground focus:ring-ring'
        case 'link':
          return 'text-primary underline-offset-4 hover:underline focus:ring-ring'
        default:
          return 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary'
      }
    }

    const getSizeClasses = () => {
      switch (size) {
        case 'sm':
          return 'h-9 rounded-md px-3 text-sm'
        case 'lg':
          return 'h-11 rounded-md px-8 text-base'
        case 'icon':
          return 'h-10 w-10 rounded-md'
        default:
          return 'h-10 px-4 py-2 text-sm'
      }
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          getVariantClasses(),
          getSizeClasses(),
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        aria-describedby={ariaDescribedBy}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-pressed={ariaPressed}
        aria-current={ariaCurrent}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="sr-only">Loading</span>
          </>
        )}
        {children}
      </button>
    )
  }
)

AccessibleButton.displayName = 'AccessibleButton'

// Accessible link button component
interface AccessibleLinkButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  announceOnClick?: boolean
  announceMessage?: string
  ariaDescribedBy?: string
  ariaExpanded?: boolean
  ariaControls?: string
  ariaPressed?: boolean
  ariaCurrent?: boolean | 'page' | 'step' | 'location' | 'date' | 'time'
}

export const AccessibleLinkButton = forwardRef<
  HTMLAnchorElement,
  AccessibleLinkButtonProps
>(
  (
    {
      children,
      className,
      variant = 'default',
      size = 'default',
      announceOnClick = false,
      announceMessage,
      ariaDescribedBy,
      ariaExpanded,
      ariaControls,
      ariaPressed,
      ariaCurrent,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (announceOnClick && announceMessage) {
        announceToScreenReader(announceMessage)
      }
      onClick?.(e)
    }

    const getVariantClasses = () => {
      switch (variant) {
        case 'destructive':
          return 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive'
        case 'outline':
          return 'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus:ring-ring'
        case 'secondary':
          return 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-ring'
        case 'ghost':
          return 'hover:bg-accent hover:text-accent-foreground focus:ring-ring'
        case 'link':
          return 'text-primary underline-offset-4 hover:underline focus:ring-ring'
        default:
          return 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary'
      }
    }

    const getSizeClasses = () => {
      switch (size) {
        case 'sm':
          return 'h-9 rounded-md px-3 text-sm'
        case 'lg':
          return 'h-11 rounded-md px-8 text-base'
        case 'icon':
          return 'h-10 w-10 rounded-md'
        default:
          return 'h-10 px-4 py-2 text-sm'
      }
    }

    return (
      <a
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          getVariantClasses(),
          getSizeClasses(),
          className
        )}
        onClick={handleClick}
        aria-describedby={ariaDescribedBy}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-pressed={ariaPressed}
        aria-current={ariaCurrent}
        {...props}
      >
        {children}
      </a>
    )
  }
)

AccessibleLinkButton.displayName = 'AccessibleLinkButton'

// Accessible toggle button component
interface AccessibleToggleButtonProps
  extends Omit<AccessibleButtonProps, 'ariaPressed' | 'onClick'> {
  pressed?: boolean
  onToggle?: (pressed: boolean) => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const AccessibleToggleButton = forwardRef<
  HTMLButtonElement,
  AccessibleToggleButtonProps
>(
  (
    {
      children,
      pressed = false,
      onToggle,
      announceOnClick = true,
      announceMessage,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const newPressed = !pressed
      onToggle?.(newPressed)

      if (announceOnClick) {
        const message =
          announceMessage ||
          `${newPressed ? 'Activated' : 'Deactivated'} ${children}`
        announceToScreenReader(message)
      }

      onClick?.(e)
    }

    return (
      <AccessibleButton
        ref={ref}
        aria-pressed={pressed}
        onClick={handleClick}
        {...props}
      >
        {children}
      </AccessibleButton>
    )
  }
)

AccessibleToggleButton.displayName = 'AccessibleToggleButton'

// Accessible icon button component
interface AccessibleIconButtonProps
  extends Omit<AccessibleButtonProps, 'size' | 'children'> {
  icon: ReactNode
  label: string
  size?: 'sm' | 'md' | 'lg'
}

export const AccessibleIconButton = forwardRef<
  HTMLButtonElement,
  AccessibleIconButtonProps
>(({ icon, label, size = 'md', className, ...props }, ref) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 w-8'
      case 'lg':
        return 'h-12 w-12'
      default:
        return 'h-10 w-10'
    }
  }

  return (
    <AccessibleButton
      ref={ref}
      size="icon"
      className={cn(getSizeClasses(), className)}
      aria-label={label}
      {...props}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </AccessibleButton>
  )
})

AccessibleIconButton.displayName = 'AccessibleIconButton'
