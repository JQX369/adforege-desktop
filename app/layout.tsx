import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import './globals.css'
import { AFFILIATE_DISCLOSURE_TEXT } from '@/lib/config'
import { SiteHeader } from '@/components/site/SiteHeader'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'The Gift Aunty',
  description: 'Personalized gift recommendations powered by AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased bg-background/80 backdrop-blur-xl`}>
        <SiteHeader />
        <div className="pt-24">{children}</div>
        <footer className="mt-12 py-8 text-center text-xs text-muted-foreground">
          {AFFILIATE_DISCLOSURE_TEXT}
        </footer>
      </body>
    </html>
  )
} 