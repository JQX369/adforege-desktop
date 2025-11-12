import React from 'react'
import { ProductDetail } from '@/src/features/product/ProductDetail'

export const dynamic = 'force-static'

export default function Page({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-6xl">
      <ProductDetail id={params.id} />
    </main>
  )
}


