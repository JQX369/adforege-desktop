import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Silence console noise in tests
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})

// JSDOM missing APIs shims
if (!('matchMedia' in window)) {
  // @ts-ignore
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
  })
}

// Prevent tests from crashing due to missing scrollTo
// @ts-ignore
global.scrollTo = () => {}

export {}
