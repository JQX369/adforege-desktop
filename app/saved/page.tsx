import React from 'react'
import { SavedPage } from '@/src/features/saved/SavedPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl">
      <SavedPage />
    </main>
  )
}


