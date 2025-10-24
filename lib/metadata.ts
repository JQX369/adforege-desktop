import { Metadata } from 'next'

export interface PageMetadataParams {
  title: string
  description: string
  keywords?: string[]
  path: string
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  author?: string
}

const DEFAULT_KEYWORDS = [
  'gift finder',
  'AI gift recommendations',
  'personalized gifts',
  'gift ideas',
  'find perfect gift',
  'gift suggestion tool',
  'AI gift assistant',
  'birthday gifts',
  'holiday gifts',
  'special occasion gifts',
  'FairyWize',
  'gift discovery',
  'present finder',
  'gift recommendations',
]

export function generatePageMetadata({
  title,
  description,
  keywords = [],
  path,
  image,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
}: PageMetadataParams): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fairywize.com'
  const fullUrl = `${siteUrl}${path}`
  const ogImage = image || `${siteUrl}/images/og-default.svg`

  const metadata: Metadata = {
    title: `${title} | FairyWize`,
    description,
    keywords: [...DEFAULT_KEYWORDS, ...keywords],
    authors: author ? [{ name: author }] : [{ name: 'FairyWize Team' }],
    creator: 'FairyWize',
    publisher: 'FairyWize',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: path,
    },
    openGraph: {
      type,
      locale: 'en_US',
      url: fullUrl,
      title: `${title} | FairyWize`,
      description,
      siteName: 'FairyWize',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${title} | FairyWize`,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(author && { authors: [author] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | FairyWize`,
      description,
      creator: '@fairywize',
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_VERIFICATION_TOKEN,
      yandex: process.env.YANDEX_VERIFICATION_TOKEN,
      yahoo: process.env.YAHOO_VERIFICATION_TOKEN,
    },
  }

  return metadata
}

// Predefined metadata for common pages
export const HOME_METADATA = generatePageMetadata({
  title: 'AI-Powered Gift Finder',
  description:
    'Discover magical gift recommendations with FairyWize AI. Answer a few questions and get personalized, shoppable gift ideas powered by advanced artificial intelligence.',
  keywords: [
    'AI gift finder',
    'personalized gift recommendations',
    'gift discovery',
  ],
  path: '/',
  image: '/images/og-home.svg',
})

export const GIFT_GUIDES_METADATA = generatePageMetadata({
  title: 'Gift Guides',
  description:
    'Discover the ultimate gift guides for every occasion. From birthday gifts to holiday presents, find the perfect gift with our curated recommendations.',
  keywords: [
    'gift guides',
    'birthday gift ideas',
    'holiday gifts',
    'occasion gifts',
  ],
  path: '/gift-guides',
  image: '/images/og-guides.svg',
})

export const ABOUT_METADATA = generatePageMetadata({
  title: 'About FairyWize',
  description:
    'Learn about FairyWize, the AI-powered gift recommendation platform that helps you find perfect presents through personalized suggestions.',
  keywords: [
    'about FairyWize',
    'gift recommendation platform',
    'AI technology',
  ],
  path: '/about',
  image: '/images/og-about.svg',
})

export const VENDOR_METADATA = generatePageMetadata({
  title: 'Vendor Dashboard',
  description:
    'Manage your product listings and track performance with FairyWize vendor dashboard. Reach gift-seekers and grow your business.',
  keywords: ['vendor dashboard', 'product listing', 'gift marketplace'],
  path: '/vendor',
  image: '/images/og-vendor.svg',
})

// Dynamic metadata for product pages
export function generateProductMetadata(product: {
  title: string
  description: string
  price: number
  currency?: string
  images: string[]
  categories: string[]
}): Metadata {
  const keywords = [
    product.title,
    ...product.categories,
    'gift idea',
    'present',
    'shopping',
  ]

  return generatePageMetadata({
    title: product.title,
    description: `${product.description} - Perfect gift idea starting from ${product.currency || '£'}${product.price}`,
    keywords,
    path: `/product/${product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    image: product.images[0] || '/images/og-product.svg',
    type: 'website',
  })
}

// Dynamic metadata for gift guide pages
export function generateGiftGuideMetadata(guide: {
  title: string
  description: string
  category: string
  occasion?: string
}): Metadata {
  const keywords = [
    guide.title,
    guide.category,
    guide.occasion || 'gifts',
    'gift guide',
    'recommendations',
  ]

  return generatePageMetadata({
    title: guide.title,
    description: guide.description,
    keywords,
    path: `/gift-guides/${guide.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    image: `/og-guide-${guide.category.toLowerCase()}.jpg`,
    type: 'article',
  })
}
