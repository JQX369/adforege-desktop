'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/ui/card'
import { Input } from '@/src/ui/input'
import { Button } from '@/src/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  const isPasswordValid = password.length >= 8
  const passwordsMatch = password === confirmPassword
  const canSubmit = isPasswordValid && passwordsMatch && !loading

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setError(
          'Invalid or expired reset link. Please request a new password reset.'
        )
      }
    }
    checkSession()
  }, [supabase])

  const updatePassword = async () => {
    setLoading(true)
    try {
      setError('')
      setSuccess('')

      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        throw new Error(error.message || 'Failed to update password')
      }

      setSuccess('Password updated successfully! Redirecting...')
      setTimeout(() => {
        router.push('/vendor/dashboard')
      }, 2000)
    } catch (e: any) {
      setError(e.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent animate-pulse"></div>
      <div className="absolute top-10 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-purple-200">Enter your new password</p>
        </div>

        <Card className="w-full max-w-md mx-auto backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl">New Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-green-300 text-sm bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <Input
                type="password"
                placeholder="New Password (8+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-purple-400"
              />
              {!isPasswordValid && password.length > 0 && (
                <p className="text-xs text-red-300">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-purple-400"
              />
              {!passwordsMatch && confirmPassword.length > 0 && (
                <p className="text-xs text-red-300">
                  Passwords don&apos;t match
                </p>
              )}
            </div>

            <Button
              onClick={updatePassword}
              disabled={!canSubmit}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>

            <div className="text-center">
              <button
                className="text-purple-300 hover:text-white text-sm underline transition-colors"
                onClick={() => router.push('/auth/sign-in')}
                disabled={loading}
              >
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
