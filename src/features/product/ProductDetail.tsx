'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/src/ui/button'

type Product = {
  id: string
  title: string
  description?: string
  price?: number
  imageUrl?: string
  affiliateUrl?: string
  categories?: string[]
  vendor?: string
  currency?: string
}

function readLastRecs(): Product[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem('fw.lastRecs')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readSaved(): Product[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('fw.saved')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null)

  useEffect(() => {
    const all = [...readLastRecs(), ...readSaved()]
    const found = all.find((p) => p.id === id) || null
    setProduct(found)
  }, [id])

  const schema = useMemo(() => {
    if (!product) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: product.description,
      image: product.imageUrl ? [product.imageUrl] : undefined,
      brand: product.vendor ? { '@type': 'Brand', name: product.vendor } : undefined,
      offers:
        typeof product.price === 'number'
          ? {
              '@type': 'Offer',
              price: product.price.toFixed(2),
              priceCurrency: product.currency || 'USD',
              availability: 'https://schema.org/InStock',
              url: product.affiliateUrl,
            }
          : undefined,
    }
  }, [product])

  if (!product) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <p className="text-muted-foreground mt-2">Try returning to Discover.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-7xl">🎁</div>
        )}
      </div>
      <div>
        <h1 className="text-3xl font-bold">{product.title}</h1>
        {typeof product.price === 'number' && (
          <div className="mt-2 text-xl font-semibold">
            {product.currency || 'USD'} ${product.price.toFixed(2)}
          </div>
        )}
        {product.categories && product.categories.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            {product.categories.join(' • ')}
          </div>
        )}
        {product.description && (
          <p className="mt-4 text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-6 flex gap-3">
          {product.affiliateUrl && (
            <a
              href={`/api/r?url=${encodeURIComponent(product.affiliateUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button>Buy now ↗</Button>
            </a>
          )}
          <a href="/discover">
            <Button variant="outline">Back to Discover</Button>
          </a>
        </div>
        {schema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        )}
      </div>
    </section>
  )
}


