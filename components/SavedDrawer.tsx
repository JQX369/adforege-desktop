'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Heart, ExternalLink, Trash2 } from 'lucide-react'
import Image from 'next/image'

interface SavedProduct {
  id: string
  title: string
  description: string
  price: number
  imageUrl: string
  affiliateUrl: string
  categories: string[]
  savedAt: string
}

interface SavedDrawerProps {
  userId: string
  trigger?: React.ReactNode
}

export function SavedDrawer({ userId, trigger }: SavedDrawerProps) {
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchSavedProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/saved/${userId}`)
      if (response.ok) {
        const data = await response.json()
        const rawProducts = Array.isArray(data.products) ? data.products : []
        const normalized: SavedProduct[] = rawProducts.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
          imageUrl: p.imageUrl || (Array.isArray(p.images) ? p.images[0] : '') || '',
          affiliateUrl: p.affiliateUrl,
          categories: Array.isArray(p.categories) ? p.categories : [],
          savedAt: p.savedAt,
        }))
        setSavedProducts(normalized)
        setSavedCount(typeof data.count === 'number' ? data.count : normalized.length)
      }
    } catch (error) {
      console.error('Error fetching saved products:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const handleRemove = async (productId: string) => {
    try {
      const response = await fetch(`/api/user/${userId}/saved/${productId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setSavedProducts(prev => prev.filter(p => p.id !== productId))
        setSavedCount(prev => prev - 1)
      }
    } catch (error) {
      console.error('Error removing saved product:', error)
    }
  }

  useEffect(() => {
    if (userId && open) {
      fetchSavedProducts()
    }
  }, [userId, open, fetchSavedProducts])

  // Refresh when a save occurs elsewhere
  useEffect(() => {
    const handler = () => {
      if (userId) fetchSavedProducts()
    }
    window.addEventListener('pg:saved-updated', handler as any)
    return () => window.removeEventListener('pg:saved-updated', handler as any)
  }, [userId, fetchSavedProducts])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className="relative">
            <Heart className="w-4 h-4 mr-2" />
            Saved
            {savedCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {savedCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Saved Gifts</SheetTitle>
          <SheetDescription>
            Your favorite gift recommendations
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">Loading saved items...</p>
            </div>
          ) : savedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Heart className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No saved items yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Swipe up on products you want to save!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-2xl">🎁</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium line-clamp-1">{product.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Saved {new Date(product.savedAt).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {product.description}
                    </p>
                      <div className="flex items-center justify-between mt-2">
                      <span className="font-semibold">${product.price.toFixed(2)}</span>
                      <div className="flex gap-2">
                        <a
                          href={`/api/r?url=${encodeURIComponent(product.affiliateUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          aria-label={`View ${product.title} on external site`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
} 