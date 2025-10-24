import { HOME_METADATA } from '@/lib/metadata'
import type { Metadata } from 'next'
import HomePageClient from '@/src/app/HomePageClient'

export const metadata: Metadata = HOME_METADATA

export default function HomePage() {
  return <HomePageClient />
}

