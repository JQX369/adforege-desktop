import { VENDOR_METADATA } from '@/lib/metadata'
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
const VendorPageClient = dynamic(() => import('../VendorPageClient'), {
  ssr: false,
})

export const metadata: Metadata = VENDOR_METADATA

export default function VendorPage() {
  return <VendorPageClient />
}
