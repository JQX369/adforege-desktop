'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/src/ui/card'
import { Badge } from '@/src/ui/badge'
import { ExternalLink } from 'lucide-react'
import Image from 'next/image'

interface BaseProductCard {
  id: string
  title: string
  description: string
  price: number
  imageUrl: string
  affiliateUrl: string
  matchScore: number
  categories: string[]
  vendor?: string
  sponsored?: boolean
  badges?: string[]
  deliveryDays?: string
  currency?: string
}

interface ProductCardProps {
  product: BaseProductCard
  className?: string
  sessionId?: string
  userId?: string
}

export function ProductCard({
  product,
  className = '',
  sessionId,
  userId,
}: ProductCardProps) {
  const [imgErrored, setImgErrored] = useState(false)
  // Build safe image src
  const rawSrc = product.imageUrl || ''
  const computedSrc =
    imgErrored || !rawSrc
      ? '/images/placeholder.png'
      : rawSrc.startsWith('//')
        ? `https:${rawSrc}`
        : rawSrc

  // Build localized link href
  let ccParam = ''
  try {
    // navigator.language like 'en-GB' -> 'GB'
    const lang =
      typeof navigator !== 'undefined' && (navigator as any).language
        ? (navigator as any).language
        : ''
    const region = (Intl as any).Locale
      ? new (Intl as any).Locale(lang).region
      : lang.split('-')[1] || ''
    if (region) ccParam = `&cc=${encodeURIComponent(region)}`
  } catch {}
  const sidParam = sessionId ? `&sid=${encodeURIComponent(sessionId)}` : ''
  const uParam = userId ? `&u=${encodeURIComponent(userId)}` : ''
  const href = `/api/r?url=${encodeURIComponent(product.affiliateUrl)}${ccParam}${sidParam}${uParam}`
  const currencySymbol =
    product.currency && product.currency.length <= 3 ? product.currency : '$'
  const vendorBadges = product.vendor
    ? [product.vendor, ...(product.badges || [])]
    : product.badges || []
  return (
    <Card className={`h-full overflow-hidden border bg-card ${className}`}>
      <div className="relative h-2/3 bg-gray-100">
        <Image
          unoptimized={Boolean(
            product.imageUrl && product.imageUrl.startsWith('http://')
          )}
          src={computedSrc as any}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-contain"
          priority={false}
          onError={() => setImgErrored(true)}
        />

        {/* Badges */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm">
            {Math.round(product.matchScore * 100)}% Match
          </Badge>
          {vendorBadges.map((badge) => (
            <Badge
              key={badge}
              variant="secondary"
              className="bg-white/70 text-neutral-800 border-white/40"
            >
              {badge}
            </Badge>
          ))}
          {product.sponsored && (
            <Badge
              variant="secondary"
              className="bg-yellow-100 text-yellow-800 border-yellow-300"
            >
              Sponsored
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-6 h-1/3 flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg md:text-xl line-clamp-1">
            {product.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>

          <div className="flex flex-wrap gap-1 mt-2">
            {product.categories.slice(0, 3).map((category) => (
              <Badge
                key={category}
                variant="outline"
                className="text-[10px] md:text-xs"
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-2xl md:text-3xl font-bold text-green-600">
            {product.price && product.price > 0
              ? `${currencySymbol}${product.price.toFixed(2)}`
              : 'Price varies'}
          </span>
          <div className="flex flex-col items-end gap-1">
            {product.deliveryDays && (
              <span className="text-xs text-muted-foreground">
                {product.deliveryDays}
              </span>
            )}
            <a
              href={href}
              target="_blank"
              rel="sponsored noopener nofollow"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              Shop Now
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
