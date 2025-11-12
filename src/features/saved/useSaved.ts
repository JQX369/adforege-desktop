'use client'

export type SavedItem = {
  id: string
  title: string
  description?: string
  price?: number
  imageUrl?: string
  affiliateUrl?: string
  savedAt: string
}

const STORAGE_KEY = 'fw.saved'

export function getSaved(): SavedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveAll(items: SavedItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('pg:saved-updated'))
    window.dispatchEvent(new CustomEvent('fw:saved-updated'))
  } catch {
    // ignore
  }
}

export function addSaved(item: SavedItem) {
  const current = getSaved()
  if (current.some((i) => i.id === item.id)) return
  saveAll([item, ...current])
}

export function removeSaved(id: string) {
  const current = getSaved()
  saveAll(current.filter((i) => i.id !== id))
}

export function clearSaved() {
  saveAll([])
}

export async function shareSaved(items: SavedItem[]) {
  const lines = items.map((i) => `• ${i.title}${i.affiliateUrl ? ` — ${i.affiliateUrl}` : ''}`)
  const text = `My FairyWize shortlist:\n\n${lines.join('\n')}`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'My FairyWize shortlist', text })
      return true
    } catch {
      // fall through to copy
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}


