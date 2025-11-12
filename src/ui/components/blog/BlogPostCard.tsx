'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/ui/card'
import { Badge } from '@/src/ui/badge'
import { Eye, Heart, Share2, Calendar } from 'lucide-react'

interface BlogPostCardProps {
  post: {
    id: string
    title: string
    slug: string
    description?: string
    excerpt?: string
    featuredImage?: string
    tags: string[]
    categories: string[]
    views: number
    likes: number
    shares: number
    publishedAt?: Date
    createdAt: Date
    author?: {
      id: string
      email: string
    }
  }
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const displayDate = post.publishedAt || post.createdAt

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
      <Link href={`/blog/${post.slug}`}>
        {/* Featured Image */}
        {post.featuredImage && (
          <div className="relative h-48 w-full overflow-hidden">
            <Image
              src={post.featuredImage}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}

        <CardHeader className="pb-3">
          {/* Categories */}
          {post.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {post.categories.slice(0, 2).map((category) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <CardTitle className="text-lg leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
            {post.title}
          </CardTitle>

          {/* Description */}
          {(post.description || post.excerpt) && (
            <CardDescription className="line-clamp-3">
              {post.description || post.excerpt}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta Information */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(displayDate)}</span>
              </div>
              {post.author && <span>By {post.author.email}</span>}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{post.views}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{post.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                <span>{post.shares}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}
