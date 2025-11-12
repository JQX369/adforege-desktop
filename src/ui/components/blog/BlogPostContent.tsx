'use client'

import Image from 'next/image'
import { Badge } from '@/src/ui/badge'
import { Button } from '@/src/ui/button'
import { Card, CardContent } from '@/src/ui/card'
import { Eye, Heart, Share2, Calendar, User, Clock } from 'lucide-react'
import { useState } from 'react'

interface BlogPostContentProps {
  post: {
    id: string
    title: string
    slug: string
    description?: string
    content: string
    excerpt?: string
    featuredImage?: string
    tags: string[]
    categories: string[]
    views: number
    likes: number
    shares: number
    publishedAt?: Date
    createdAt: Date
    updatedAt: Date
    author?: {
      id: string
      email: string
    }
  }
}

export function BlogPostContent({ post }: BlogPostContentProps) {
  const [likes, setLikes] = useState(post.likes)
  const [shares, setShares] = useState(post.shares)
  const [isLiked, setIsLiked] = useState(false)

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const displayDate = post.publishedAt || post.createdAt

  const handleLike = async () => {
    if (isLiked) return

    try {
      // In a real implementation, this would call an API
      setLikes((prev) => prev + 1)
      setIsLiked(true)
    } catch (error) {
      console.error('Error liking post:', error)
    }
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.description || post.excerpt,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        // Show toast notification
      }
      setShares((prev) => prev + 1)
    } catch (error) {
      console.error('Error sharing post:', error)
    }
  }

  const estimateReadingTime = (content: string) => {
    const wordsPerMinute = 200
    const wordCount = content.split(/\s+/).length
    return Math.ceil(wordCount / wordsPerMinute)
  }

  const readingTime = estimateReadingTime(post.content)

  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Featured Image */}
      {post.featuredImage && (
        <div className="relative h-64 md:h-96 w-full overflow-hidden">
          <Image
            src={post.featuredImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      )}

      <div className="p-6 md:p-8">
        {/* Header */}
        <header className="mb-6">
          {/* Categories */}
          {post.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(displayDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{readingTime} min read</span>
            </div>
            {post.author && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>By {post.author.email}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>{post.views} views</span>
            </div>
          </div>

          {/* Description */}
          {(post.description || post.excerpt) && (
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              {post.description || post.excerpt}
            </p>
          )}
        </header>

        {/* Content */}
        <div className="prose prose-lg max-w-none mb-8">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex items-center gap-4">
            <Button
              variant={isLiked ? 'default' : 'outline'}
              size="sm"
              onClick={handleLike}
              disabled={isLiked}
            >
              <Heart
                className={`h-4 w-4 mr-2 ${isLiked ? 'fill-current' : ''}`}
              />
              {likes} {likes === 1 ? 'Like' : 'Likes'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              {shares} {shares === 1 ? 'Share' : 'Shares'}
            </Button>
          </div>

          <div className="text-sm text-gray-500">
            Last updated: {formatDate(post.updatedAt)}
          </div>
        </div>
      </div>
    </article>
  )
}
