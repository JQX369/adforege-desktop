import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all approved products for sitemap
    const products = await prisma.product.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fairywize.com'

    // Static pages
    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'daily' },
      { url: '/vendor', priority: '0.8', changefreq: 'weekly' },
      { url: '/about', priority: '0.6', changefreq: 'monthly' },
      { url: '/privacy', priority: '0.4', changefreq: 'monthly' },
      { url: '/terms', priority: '0.4', changefreq: 'monthly' },
    ]

    // Product pages (if we had individual product pages)
    const productPages = products.slice(0, 1000).map((product) => ({
      url: `/gift/${product.id}`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: product.updatedAt.toISOString().split('T')[0],
    }))

    const allPages = [...staticPages, ...productPages]

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}
