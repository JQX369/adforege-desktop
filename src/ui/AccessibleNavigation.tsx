'use client'

import { forwardRef, ReactNode, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { announceToScreenReader } from '@/lib/accessibility'

// Accessible navigation component
interface AccessibleNavigationProps {
  children: ReactNode
  className?: string
  role?: 'navigation' | 'menubar' | 'tablist'
  ariaLabel?: string
  orientation?: 'horizontal' | 'vertical'
}

export function AccessibleNavigation({
  children,
  className,
  role = 'navigation',
  ariaLabel,
  orientation = 'horizontal',
}: AccessibleNavigationProps) {
  return (
    <nav
      className={cn(
        'flex',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
      role={role}
      aria-label={ariaLabel}
      aria-orientation={orientation}
    >
      {children}
    </nav>
  )
}

// Accessible navigation item component
interface AccessibleNavigationItemProps {
  children: ReactNode
  href?: string
  isActive?: boolean
  isDisabled?: boolean
  onClick?: () => void
  className?: string
  ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean
  announceOnClick?: boolean
  announceMessage?: string
}

export function AccessibleNavigationItem({
  children,
  href,
  isActive = false,
  isDisabled = false,
  onClick,
  className,
  ariaCurrent,
  announceOnClick = false,
  announceMessage,
}: AccessibleNavigationItemProps) {
  const handleClick = () => {
    if (announceOnClick && announceMessage) {
      announceToScreenReader(announceMessage)
    }
    onClick?.()
  }

  const baseClasses = cn(
    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    isActive && 'bg-primary text-primary-foreground',
    !isActive && !isDisabled && 'hover:bg-accent hover:text-accent-foreground',
    isDisabled && 'opacity-50 cursor-not-allowed',
    className
  )

  if (href && !isDisabled) {
    return (
      <a
        href={href}
        className={baseClasses}
        aria-current={isActive ? ariaCurrent || 'page' : undefined}
        onClick={handleClick}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      className={baseClasses}
      disabled={isDisabled}
      aria-current={isActive ? ariaCurrent || 'page' : undefined}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

// Accessible dropdown menu component
interface AccessibleDropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  className?: string
  triggerClassName?: string
  contentClassName?: string
  ariaLabel?: string
  announceOnOpen?: boolean
  announceOnClose?: boolean
  openMessage?: string
  closeMessage?: string
}

export function AccessibleDropdownMenu({
  trigger,
  children,
  className,
  triggerClassName,
  contentClassName,
  ariaLabel,
  announceOnOpen = false,
  announceOnClose = false,
  openMessage,
  closeMessage,
}: AccessibleDropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | HTMLAnchorElement)[]>([])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setFocusedIndex(-1)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && itemRefs.current.length > 0) {
      itemRefs.current[0]?.focus()
      setFocusedIndex(0)
    }
  }, [isOpen])

  const handleTriggerClick = () => {
    const newIsOpen = !isOpen
    setIsOpen(newIsOpen)

    if (newIsOpen && announceOnOpen && openMessage) {
      announceToScreenReader(openMessage)
    } else if (!newIsOpen && announceOnClose && closeMessage) {
      announceToScreenReader(closeMessage)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, itemRefs.current.length - 1)
          itemRefs.current[next]?.focus()
          return next
        })
        break
      case 'ArrowUp':
        event.preventDefault()
        setFocusedIndex((prev) => {
          const next = Math.max(prev - 1, 0)
          itemRefs.current[next]?.focus()
          return next
        })
        break
      case 'Home':
        event.preventDefault()
        setFocusedIndex(0)
        itemRefs.current[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        const lastIndex = itemRefs.current.length - 1
        setFocusedIndex(lastIndex)
        itemRefs.current[lastIndex]?.focus()
        break
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        className={triggerClassName}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={ariaLabel}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={contentRef}
          className={cn(
            'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            contentClassName
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {children}
        </div>
      )}
    </div>
  )
}

// Accessible dropdown menu item component
interface AccessibleDropdownMenuItemProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  isDisabled?: boolean
  className?: string
  announceOnClick?: boolean
  announceMessage?: string
}

export const AccessibleDropdownMenuItem = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  AccessibleDropdownMenuItemProps
>(
  (
    {
      children,
      href,
      onClick,
      isDisabled = false,
      className,
      announceOnClick = false,
      announceMessage,
    },
    ref
  ) => {
    const handleClick = () => {
      if (announceOnClick && announceMessage) {
        announceToScreenReader(announceMessage)
      }
      onClick?.()
    }

    const baseClasses = cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )

    if (href && !isDisabled) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={baseClasses}
          onClick={handleClick}
          role="menuitem"
        >
          {children}
        </a>
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={baseClasses}
        disabled={isDisabled}
        onClick={handleClick}
        role="menuitem"
      >
        {children}
      </button>
    )
  }
)

AccessibleDropdownMenuItem.displayName = 'AccessibleDropdownMenuItem'

// Accessible breadcrumb component
interface AccessibleBreadcrumbProps {
  items: Array<{
    label: string
    href?: string
    isCurrentPage?: boolean
  }>
  className?: string
  separator?: ReactNode
  announceOnClick?: boolean
  announceMessage?: string
}

export function AccessibleBreadcrumb({
  items,
  className,
  separator = '/',
  announceOnClick = false,
  announceMessage,
}: AccessibleBreadcrumbProps) {
  return (
    <nav
      className={cn(
        'flex items-center space-x-1 text-sm text-muted-foreground',
        className
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span className="mx-1" aria-hidden="true">
                {separator}
              </span>
            )}
            {item.isCurrentPage ? (
              <span className="font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                onClick={() => {
                  if (announceOnClick && announceMessage) {
                    announceToScreenReader(announceMessage)
                  }
                }}
              >
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Accessible pagination component
interface AccessiblePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  showFirstLast?: boolean
  showPrevNext?: boolean
  maxVisiblePages?: number
  announceOnClick?: boolean
  announceMessage?: string
}

export function AccessiblePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showFirstLast = true,
  showPrevNext = true,
  maxVisiblePages = 5,
  announceOnClick = false,
  announceMessage,
}: AccessiblePaginationProps) {
  const getVisiblePages = () => {
    const pages: number[] = []
    const half = Math.floor(maxVisiblePages / 2)
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, currentPage + half)

    if (end - start + 1 < maxVisiblePages) {
      if (start === 1) {
        end = Math.min(totalPages, start + maxVisiblePages - 1)
      } else {
        start = Math.max(1, end - maxVisiblePages + 1)
      }
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    return pages
  }

  const handlePageClick = (page: number) => {
    onPageChange(page)
    if (announceOnClick && announceMessage) {
      announceToScreenReader(`${announceMessage} ${page}`)
    }
  }

  const visiblePages = getVisiblePages()

  return (
    <nav
      className={cn('flex items-center justify-center space-x-1', className)}
      aria-label="Pagination"
    >
      {showFirstLast && currentPage > 1 && (
        <button
          onClick={() => handlePageClick(1)}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          aria-label="Go to first page"
        >
          First
        </button>
      )}

      {showPrevNext && currentPage > 1 && (
        <button
          onClick={() => handlePageClick(currentPage - 1)}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          aria-label="Go to previous page"
        >
          Previous
        </button>
      )}

      {visiblePages.map((page) => (
        <button
          key={page}
          onClick={() => handlePageClick(page)}
          className={cn(
            'px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            page === currentPage
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
          aria-label={`Go to page ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}

      {showPrevNext && currentPage < totalPages && (
        <button
          onClick={() => handlePageClick(currentPage + 1)}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          aria-label="Go to next page"
        >
          Next
        </button>
      )}

      {showFirstLast && currentPage < totalPages && (
        <button
          onClick={() => handlePageClick(totalPages)}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          aria-label="Go to last page"
        >
          Last
        </button>
      )}
    </nav>
  )
}

// Accessible tabs component
interface AccessibleTabsProps {
  tabs: Array<{
    id: string
    label: string
    content: ReactNode
    disabled?: boolean
  }>
  defaultTab?: string
  className?: string
  tabListClassName?: string
  tabPanelClassName?: string
  announceOnChange?: boolean
  announceMessage?: string
}

export function AccessibleTabs({
  tabs,
  defaultTab,
  className,
  tabListClassName,
  tabPanelClassName,
  announceOnChange = false,
  announceMessage,
}: AccessibleTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (tabRefs.current[focusedIndex]) {
      tabRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    if (announceOnChange && announceMessage) {
      announceToScreenReader(announceMessage)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        const prevIndex = index === 0 ? tabs.length - 1 : index - 1
        setFocusedIndex(prevIndex)
        break
      case 'ArrowRight':
        event.preventDefault()
        const nextIndex = index === tabs.length - 1 ? 0 : index + 1
        setFocusedIndex(nextIndex)
        break
      case 'Home':
        event.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        event.preventDefault()
        setFocusedIndex(tabs.length - 1)
        break
    }
  }

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn('flex border-b', tabListClassName)}
        role="tablist"
        aria-orientation="horizontal"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[index] = el)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              tab.id === activeTab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTabContent && (
        <div
          className={cn('mt-4', tabPanelClassName)}
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTabContent}
        </div>
      )}
    </div>
  )
}
