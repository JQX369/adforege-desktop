import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('a', undefined, null as any, false as any, 'b', {
      c: true,
      d: false,
    })
    expect(result).toContain('a')
    expect(result).toContain('b')
    expect(result).toContain('c')
    expect(result).not.toContain('d')
  })
})
