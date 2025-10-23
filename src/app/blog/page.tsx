import { Metadata } from 'next'
import { ContentManager } from '@/src/features/cms/content-manager'
import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { BlogFilters } from '@/components/blog/BlogFilters'
import { Pagination } from '@/src/ui/pagination'

export const metadata: Metadata = {
  title: 'Gift Blog & Guides | FairyWize',
  description:
    'Discover expert gift guides, tips, and recommendations from our blog. Find the perfect gifts for every occasion.',
  keywords: [
    'gift blog',
    'gift guides',
    'gift tips',
    'recommendations',
    'gift ideas',
  ],
  openGraph: {
    title: 'Gift Blog & Guides | FairyWize',
    description:
      'Discover expert gift guides, tips, and recommendations from our blog.',
    type: 'website',
  },
}

interface BlogPageProps {
  searchParams: {
    page?: string
    category?: string
    tag?: string
    search?: string
  }
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const contentManager = new ContentManager()

  const page = parseInt(searchParams.page || '1')
  const limit = 12
  const offset = (page - 1) * limit

  const filters = {
    type: 'BLOG_POST' as const,
    status: 'PUBLISHED' as const,
    published: true,
    ...(searchParams.category && { categories: [searchParams.category] }),
    ...(searchParams.tag && { tags: [searchParams.tag] }),
    ...(searchParams.search && { search: searchParams.search }),
    limit,
    offset,
  }

  const [posts, popularPosts] = await Promise.all([
    contentManager.listContent(filters),
    contentManager.getPopularContent(5),
  ])

  const totalPages = Math.ceil(posts.length / limit)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Gift Blog & Guides
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover expert gift guides, tips, and recommendations to help you
            find the perfect gifts for every occasion.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Filters */}
            <BlogFilters
              currentCategory={searchParams.category}
              currentTag={searchParams.tag}
              currentSearch={searchParams.search}
            />

            {/* Blog Posts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                baseUrl="/blog"
                searchParams={searchParams}
              />
            )}

            {/* No Posts Message */}
            {posts.length === 0 && (
              <div className="text-center py-12">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No blog posts found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your filters or search terms.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Popular Posts
              </h3>
              <div className="space-y-4">
                {popularPosts.map((post) => (
                  <div
                    key={post.id}
                    className="border-b border-gray-200 pb-4 last:border-b-0"
                  >
                    <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                      {post.title}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center text-xs text-gray-500">
                      <span>{post.views} views</span>
                      <span className="mx-2">•</span>
                      <span>{post.likes} likes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Categories
              </h3>
              <div className="space-y-2">
                {[
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
                ].map((category) => (
                  <a
                    key={category}
                    href={`/blog?category=${encodeURIComponent(category)}`}
                    className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                      searchParams.category === category
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category}
                  </a>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Popular Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
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
                ].map((tag) => (
                  <a
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      searchParams.tag === tag
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
