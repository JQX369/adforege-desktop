import { createClient } from '@supabase/supabase-js'

export type SupabaseClientType = ReturnType<typeof createClient>

export function createSupabaseBrowserClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	
	if (!url || !anon) {
		console.warn('Supabase environment variables not found. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
		console.warn('URL:', url)
		console.warn('ANON:', anon ? 'present' : 'missing')
		// Return a mock client that won't crash but won't work either
		return {
			auth: {
				signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
				signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
				signOut: async () => ({ data: null, error: new Error('Supabase not configured') }),
				getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
				onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
			}
		} as any
	}
	
	return createClient(url, anon)
}