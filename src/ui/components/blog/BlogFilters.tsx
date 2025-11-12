'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/src/ui/button'
import { Input } from '@/src/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/ui/select'
import { Search, Filter, X } from 'lucide-react'

interface BlogFiltersProps {
  currentCategory?: string
  currentTag?: string
  currentSearch?: string
}

export function BlogFilters({
  currentCategory,
  currentTag,
  currentSearch,
}: BlogFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(currentSearch || '')
  const [showFilters, setShowFilters] = useState(false)

  const categories = [
    'Holiday',
    'Romance',
    'Family',
    'Tech',
    'Fashion',
    'Home',
    'Sports',
    'Books',
    'Beauty',
    'Kids',
  ]

  const tags = [
    'gifts',
    'recommendations',
    'guide',
    '2024',
    'best',
    'holiday',
    'christmas',
    'valentine',
    'birthday',
    'anniversary',
  ]

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    // Reset to page 1 when filters change
    params.delete('page')

    router.push(`/blog?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters('search', search)
  }

  const clearFilters = () => {
    router.push('/blog')
    setSearch('')
  }

  const hasActiveFilters = currentCategory || currentTag || currentSearch

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search blog posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="default">
          Search
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
        {hasActiveFilters && (
          <Button type="button" variant="outline" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </form>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {currentCategory && (
            <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
              <span>Category: {currentCategory}</span>
              <button
                onClick={() => updateFilters('category', '')}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {currentTag && (
            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
              <span>Tag: #{currentTag}</span>
              <button
                onClick={() => updateFilters('tag', '')}
                className="hover:text-green-900"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {currentSearch && (
            <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
              <span>Search: "{currentSearch}"</span>
              <button
                onClick={() => updateFilters('search', '')}
                className="hover:text-purple-900"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <Select
              value={currentCategory || ''}
              onValueChange={(value) => updateFilters('category', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag
            </label>
            <Select
              value={currentTag || ''}
              onValueChange={(value) => updateFilters('tag', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    #{tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
