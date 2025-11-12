import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentManager } from '@/src/features/cms/content-manager'
import { BlogPostContent } from '@/components/blog/BlogPostContent'
import { BlogPostSidebar } from '@/components/blog/BlogPostSidebar'
import { BlogPostComments } from '@/components/blog/BlogPostComments'

interface BlogPostPageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const contentManager = new ContentManager()
  const post = await contentManager.getContentBySlug(params.slug)

  if (!post) {
    return {
      title: 'Post Not Found | FairyWize',
    }
  }

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.description || post.excerpt || undefined,
    keywords: post.metaKeywords,
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.description || post.excerpt || undefined,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.author ? [post.author.email] : undefined,
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.description || post.excerpt || undefined,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const contentManager = new ContentManager()
  const post = await contentManager.getContentBySlug(params.slug)

  if (!post) {
    notFound()
  }

  // Track view
  await contentManager.trackContentView(post.id)

  // Get related content
  const [relatedPosts, popularPosts] = await Promise.all([
    contentManager.getContentByCategory(post.categories[0] || 'General', 3),
    contentManager.getPopularContent(5),
  ])

  // Filter out current post from related posts
  const filteredRelatedPosts = relatedPosts
    .filter((p) => p.id !== post.id)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <BlogPostContent post={{
              ...post,
              description: post.description ?? undefined,
              excerpt: post.excerpt ?? undefined,
              featuredImage: post.featuredImage ?? undefined,
              author: post.author ?? undefined,
            }} />
            <BlogPostComments postId={post.id} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <BlogPostSidebar
              post={post}
              relatedPosts={filteredRelatedPosts}
              popularPosts={popularPosts}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
