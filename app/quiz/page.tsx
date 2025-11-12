import React from 'react'
import { Quiz } from '@/src/features/quiz/Quiz'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl py-10">
      <Quiz />
    </main>
  )
}


