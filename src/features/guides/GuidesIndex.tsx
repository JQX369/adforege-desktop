'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/ui/card'
import { Badge } from '@/src/ui/badge'
import { Input } from '@/src/ui/input'

export type GuideItem = {
  title: string
  description: string
  href: string
  badge: string
  category: string
  searchVolume: string
}

export function GuidesIndex({
  guides,
  categories,
}: {
  guides: GuideItem[]
  categories: { name: string; value: string }[]
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')

  const filtered = useMemo(() => {
    return guides.filter((g) => {
      const matchesQuery =
        !query ||
        g.title.toLowerCase().includes(query.toLowerCase()) ||
        g.description.toLowerCase().includes(query.toLowerCase())
      const matchesCategory =
        category === 'all' || g.category.toLowerCase().includes(category.toLowerCase())
      return matchesQuery && matchesCategory
    })
  }, [guides, query, category])

  return (
    <>
      <div className="mx-auto mb-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search guides…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
          aria-label="Search gift guides"
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((guide) => (
          <Card
            key={guide.href}
            className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <CardHeader>
              <div className="mb-2 flex items-start justify-between">
                <Badge variant="outline" className="text-xs">
                  {guide.badge}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {guide.searchVolume} searches/mo
                </span>
              </div>
              <CardTitle className="transition-colors group-hover:text-primary">
                <Link href={guide.href} className="hover:underline">
                  {guide.title}
                </Link>
              </CardTitle>
              <CardDescription>{guide.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {guide.category}
                </Badge>
                <Link
                  href={guide.href}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Explore Guide →
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border p-8 text-center text-muted-foreground">
            No guides match your filters.
          </div>
        )}
      </div>
    </>
  )
}


