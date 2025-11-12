'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/src/ui/button'
import { removeSaved, getSaved, shareSaved, type SavedItem, clearSaved } from './useSaved'

export function SavedPage() {
  const [items, setItems] = useState<SavedItem[]>([])
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    setItems(getSaved())
    const onUpdate = () => setItems(getSaved())
    window.addEventListener('pg:saved-updated', onUpdate as any)
    window.addEventListener('fw:saved-updated', onUpdate as any)
    return () => {
      window.removeEventListener('pg:saved-updated', onUpdate as any)
      window.removeEventListener('fw:saved-updated', onUpdate as any)
    }
  }, [])

  const handleRemove = (id: string) => {
    removeSaved(id)
    setItems(getSaved())
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const ok = await shareSaved(items)
      if (ok) {
        // optional: toast
      }
    } finally {
      setIsSharing(false)
    }
  }

  const total = useMemo(
    () =>
      items.reduce((sum, i) => (typeof i.price === 'number' ? sum + i.price : sum), 0),
    [items]
  )

  return (
    <section className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Shortlist</h1>
          <p className="text-muted-foreground">{items.length} items saved</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { clearSaved(); setItems([]) }} disabled={items.length === 0}>
            Clear
          </Button>
          <Button onClick={handleShare} disabled={items.length === 0 || isSharing}>
            {isSharing ? 'Sharing…' : 'Share list'}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="h-64 grid place-items-center text-center text-muted-foreground border rounded-xl">
          <div>
            <div className="text-5xl mb-3">💝</div>
            <p>No saved gifts yet.</p>
            <p className="text-sm mt-1">Swipe right on items to save them.</p>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 rounded-xl border bg-card p-3">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-2xl">🎁</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="line-clamp-1 font-semibold">{item.title}</h4>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(item.id)}>
                    Remove
                  </Button>
                </div>
                {typeof item.price === 'number' && (
                  <div className="text-sm font-semibold mt-1">${item.price.toFixed(2)}</div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {item.affiliateUrl && (
                    <a
                      className="text-sm text-primary hover:underline"
                      href={`/api/r?url=${encodeURIComponent(item.affiliateUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buy now ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="mt-6 text-right text-sm text-muted-foreground">
          <span>Total items: {items.length}</span>
          {total > 0 && <span className="ml-3">Est. total: ${total.toFixed(2)}</span>}
        </div>
      )}
    </section>
  )
}


