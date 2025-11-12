// Development auth bypass for when Supabase email auth is misconfigured
const DEV_USERS = [
  {
    email: 'vendor@fairywize.com',
    password: 'SecurePass123!',
    id: 'dev-user-1',
  },
  { email: 'test@example.com', password: 'password123', id: 'dev-user-2' },
  { email: 'admin@fairywize.com', password: 'AdminPass123!', id: 'dev-user-3' },
]

export function isDevMode(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === 'true'
  )
}

export function validateDevCredentials(
  email: string,
  password: string
): { success: boolean; user?: any; error?: string } {
  if (!isDevMode()) {
    return { success: false, error: 'Dev auth not enabled' }
  }

  const user = DEV_USERS.find(
    (u) => u.email === email && u.password === password
  )
  if (!user) {
    return { success: false, error: 'Invalid credentials' }
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  }
}

export function createDevSession(user: any) {
  if (!isDevMode()) return null

  return {
    access_token: `dev-token-${user.id}`,
    refresh_token: `dev-refresh-${user.id}`,
    expires_in: 3600,
    user,
  }
}
