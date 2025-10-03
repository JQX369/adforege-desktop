import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import './globals.css'
import { AFFILIATE_DISCLOSURE_TEXT } from '@/lib/config'
import { SiteHeader } from '@/components/site/SiteHeader'
import { CurrencyProvider } from '@/lib/currency-context'
import { websiteSchema, organizationSchema, softwareApplicationSchema } from '@/lib/schema'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'FairyWize - AI-Powered Gift Finder | Find Perfect Presents',
    template: '%s | FairyWize'
  },
  description: 'Discover magical gift recommendations with FairyWize AI. Answer a few questions and get personalized, shoppable gift ideas powered by advanced artificial intelligence.',
  keywords: [
    'gift finder', 'AI gift recommendations', 'personalized gifts', 'gift ideas',
    'find perfect gift', 'gift suggestion tool', 'AI gift assistant',
    'birthday gifts', 'holiday gifts', 'special occasion gifts'
  ],
  authors: [{ name: 'FairyWize Team' }],
  creator: 'FairyWize',
  publisher: 'FairyWize',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://fairywize.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'FairyWize - AI-Powered Gift Finder | Find Perfect Presents',
    description: 'Discover magical gift recommendations with FairyWize AI. Answer a few questions and get personalized, shoppable gift ideas powered by advanced artificial intelligence.',
    siteName: 'FairyWize',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'FairyWize - AI-Powered Gift Finder',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FairyWize - AI-Powered Gift Finder | Find Perfect Presents',
    description: 'Discover magical gift recommendations with FairyWize AI. Answer a few questions and get personalized, shoppable gift ideas powered by advanced artificial intelligence.',
    creator: '@fairywize',
    images: ['/og-image.jpg'],
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

// Structured Data for SEO
const structuredData = [
  websiteSchema,
  organizationSchema,
  softwareApplicationSchema
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        {structuredData.map((schema, index) => (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(schema),
            }}
          />
        ))}
      </head>
      <body className={`${inter.className} h-full antialiased bg-background/80 backdrop-blur-xl`}>
        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                    page_title: document.title,
                    page_location: window.location.href,
                  });
                `,
              }}
            />
          </>
        )}

        <CurrencyProvider>
          <SiteHeader />
          <div className="pt-20">{children}</div>
          <footer className="mt-12 py-8 text-center text-xs text-muted-foreground">
            {AFFILIATE_DISCLOSURE_TEXT}
          </footer>
        </CurrencyProvider>
      </body>
    </html>
  )
} 