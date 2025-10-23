import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    console.warn('Supabase environment variables not found on server')
    // Return a mock client for development
    return {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: new Error('Supabase not configured'),
        }),
        signOut: async () => ({
          data: null,
          error: new Error('Supabase not configured'),
        }),
      },
    } as any
  }

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookies().get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        cookies().set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        cookies().set({ name, value: '', ...options })
      },
    },
  })
}
