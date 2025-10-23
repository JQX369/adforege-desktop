import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fairywize.com'

    // Get all approved products
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        updatedAt: true,
        status: true,
      },
      where: {
        status: 'APPROVED',
        availability: 'IN_STOCK',
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Static pages
    const staticPages = [
      {
        url: '/',
        lastModified: new Date().toISOString(),
        changeFrequency: 'daily',
        priority: '1.0',
      },
      {
        url: '/gift-guides',
        lastModified: new Date().toISOString(),
        changeFrequency: 'weekly',
        priority: '0.8',
      },
      {
        url: '/about',
        lastModified: new Date().toISOString(),
        changeFrequency: 'monthly',
        priority: '0.6',
      },
      {
        url: '/vendor',
        lastModified: new Date().toISOString(),
        changeFrequency: 'monthly',
        priority: '0.5',
      },
    ]

    // Gift guide categories
    const giftGuideCategories = [
      'birthday',
      'christmas',
      'anniversary',
      'valentine',
      'graduation',
      'wedding',
      'baby-shower',
      'housewarming',
      'mothers-day',
      'fathers-day',
    ]

    const giftGuidePages = giftGuideCategories.map((category) => ({
      url: `/gift-guides/${category}`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: '0.7',
    }))

    // Product pages
    const productPages = products.map((product) => ({
      url: `/product/${product.id}`,
      lastModified: product.updatedAt.toISOString(),
      changeFrequency: 'weekly',
      priority: '0.6',
    }))

    // Combine all pages
    const allPages = [...staticPages, ...giftGuidePages, ...productPages]

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastModified}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)

    // Fallback sitemap with just static pages
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL || 'https://fairywize.com'}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL || 'https://fairywize.com'}/gift-guides</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`

    return new Response(fallbackSitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  }
}
