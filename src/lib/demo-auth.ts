// Demo auth system for testing without Supabase
export const DEMO_USER = {
  id: 'demo-user-123',
  email: 'demo@example.com',
}

export function isDemoMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function getDemoUser() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('demo_user')
    if (stored) return JSON.parse(stored)
  }
  return null
}

export function setDemoUser(email: string) {
  if (typeof window !== 'undefined') {
    const user = { id: `demo-${Date.now()}`, email }
    localStorage.setItem('demo_user', JSON.stringify(user))
    return user
  }
  return null
}

export function clearDemoUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('demo_user')
  }
}
