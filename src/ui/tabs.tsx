'use client'

import * as React from 'react'

type TabsContextType = {
  value: string
  setValue: (v: string) => void
}

const TabsContext = React.createContext<TabsContextType | null>(null)

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  className = '',
  children,
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue || '')
  const isControlled = controlled !== undefined
  const value = isControlled ? (controlled as string) : uncontrolled
  const setValue = (v: string) => {
    if (!isControlled) setUncontrolled(v)
    onValueChange?.(v)
  }
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={`flex gap-2 border-b ${className}`}>{children}</div>
}

export function TabsTrigger({
  value,
  className = '',
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsContext)!
  const active = ctx.value === value
  return (
    <button
      type="button"
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600'} ${className}`}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className = '',
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsContext)!
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}

export default Tabs
