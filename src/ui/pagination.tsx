'use client'

import * as React from 'react'

export interface PaginationProps {
  page: number
  pageCount: number
  onPageChange?: (page: number) => void
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const prev = () => onPageChange?.(Math.max(1, page - 1))
  const next = () => onPageChange?.(Math.min(pageCount, page + 1))
  return (
    <div className="flex items-center gap-2">
      <button
        className="rounded border px-2 py-1 text-sm"
        onClick={prev}
        disabled={page <= 1}
      >
        Prev
      </button>
      <span className="text-sm">
        Page {page} of {pageCount}
      </span>
      <button
        className="rounded border px-2 py-1 text-sm"
        onClick={next}
        disabled={page >= pageCount}
      >
        Next
      </button>
    </div>
  )
}

export default Pagination
