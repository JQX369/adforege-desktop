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
import { Eye, Heart, Calendar } from 'lucide-react'

interface BlogPostSidebarProps {
  post: {
    id: string
    title: string
    slug: string
    categories: string[]
    tags: string[]
  }
  relatedPosts: Array<{
    id: string
    title: string
    slug: string
    excerpt?: string
    featuredImage?: string
    views: number
    likes: number
    publishedAt?: Date
    createdAt: Date
  }>
  popularPosts: Array<{
    id: string
    title: string
    slug: string
    excerpt?: string
    featuredImage?: string
    views: number
    likes: number
    publishedAt?: Date
    createdAt: Date
  }>
}

export function BlogPostSidebar({
  post,
  relatedPosts,
  popularPosts,
}: BlogPostSidebarProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  return (
    <div className="space-y-6">
      {/* Table of Contents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Table of Contents</CardTitle>
        </CardHeader>
        <CardContent>
          <nav className="space-y-2">
            <a
              href="#introduction"
              className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Introduction
            </a>
            <a
              href="#what-to-look-for"
              className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              What to Look For
            </a>
            <a
              href="#recommendations"
              className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Our Recommendations
            </a>
            <a
              href="#conclusion"
              className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Conclusion
            </a>
            <a
              href="#faq"
              className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              FAQ
            </a>
          </nav>
        </CardContent>
      </Card>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Related Posts</CardTitle>
            <CardDescription>More articles you might enjoy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  href={`/blog/${relatedPost.slug}`}
                  className="block group"
                >
                  <div className="flex gap-3">
                    {relatedPost.featuredImage && (
                      <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-md">
                        <Image
                          src={relatedPost.featuredImage}
                          alt={relatedPost.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                        {relatedPost.title}
                      </h4>
                      {relatedPost.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {relatedPost.excerpt}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-gray-500">
                        <span>
                          {formatDate(
                            relatedPost.publishedAt || relatedPost.createdAt
                          )}
                        </span>
                        <span className="mx-2">•</span>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{relatedPost.views}</span>
                        </div>
                        <span className="mx-2">•</span>
                        <div className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          <span>{relatedPost.likes}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Popular Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Popular Posts</CardTitle>
          <CardDescription>Most viewed articles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {popularPosts.map((popularPost) => (
              <Link
                key={popularPost.id}
                href={`/blog/${popularPost.slug}`}
                className="block group"
              >
                <div className="flex gap-3">
                  {popularPost.featuredImage && (
                    <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={popularPost.featuredImage}
                        alt={popularPost.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                      {popularPost.title}
                    </h4>
                    {popularPost.excerpt && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {popularPost.excerpt}
                      </p>
                    )}
                    <div className="flex items-center text-xs text-gray-500">
                      <span>
                        {formatDate(
                          popularPost.publishedAt || popularPost.createdAt
                        )}
                      </span>
                      <span className="mx-2">•</span>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{popularPost.views}</span>
                      </div>
                      <span className="mx-2">•</span>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span>{popularPost.likes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {post.categories.map((category) => (
              <Link
                key={category}
                href={`/blog?category=${encodeURIComponent(category)}`}
                className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {category}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Newsletter Signup */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">Stay Updated</CardTitle>
          <CardDescription className="text-blue-700">
            Get the latest gift guides and tips delivered to your inbox
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
              Subscribe
            </button>
            <p className="text-xs text-blue-600">
              No spam, unsubscribe at any time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
