import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

class AdminAuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function assertAdmin(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw new AdminAuthError('Unauthorized', 401)
  }

  const user = data?.user
  if (!user?.email) {
    throw new AdminAuthError('Unauthorized', 401)
  }

  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowedEmails.length > 0 && !allowedEmails.includes(user.email.toLowerCase())) {
    throw new AdminAuthError('Forbidden', 403)
  }

  return user
}

export { AdminAuthError }

