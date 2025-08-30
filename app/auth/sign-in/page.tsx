'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { isDevMode, validateDevCredentials, createDevSession } from '@/lib/dev-auth'

export default function SignInPage() {
  const supabase = createSupabaseBrowserClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'reset'>('sign-in')
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  const isEmailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email])
  const isPasswordValid = useMemo(() => password.length >= 8, [password])
  const canSubmit = useMemo(() => {
    if (mode === 'reset') return isEmailValid && !loading
    return isEmailValid && isPasswordValid && !loading
  }, [mode, isEmailValid, isPasswordValid, loading])

  const signIn = async () => {
    setLoading(true)
    try {
      setError('')
      setSuccess('')
      console.log('Attempting sign in with:', email)
      
      // Try dev auth first if enabled
      if (isDevMode()) {
        const devResult = validateDevCredentials(email, password)
        if (devResult.success) {
          console.log('Dev auth successful:', devResult.user?.email)
          // Store dev session in localStorage
          localStorage.setItem('dev-auth-user', JSON.stringify(devResult.user))
          const params = new URLSearchParams(window.location.search)
          const redirectTo = params.get('redirect') || '/vendor/dashboard'
          window.location.href = redirectTo
          return
        }
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      console.log('Sign in response:', { data: !!data, error: error?.message })
      
      if (error) {
        console.error('Auth error:', error)
        // Provide helpful error messages
        if (error.message?.includes('invalid')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.')
        }
        throw new Error(error.message || 'Unable to sign in')
      }
      
      const params = new URLSearchParams(window.location.search)
      const redirectTo = params.get('redirect') || '/vendor/dashboard'
      console.log('Redirecting to:', redirectTo)
      window.location.href = redirectTo
    } catch (e: any) {
      console.error('Sign in failed:', e)
      setError(e.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const signUp = async () => {
    setLoading(true)
    try {
      setError('')
      setSuccess('')
      console.log('Attempting sign up with:', email)
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/vendor/dashboard`
        }
      })
      console.log('Sign up response:', { data: !!data, error: error?.message })
      
      if (error) {
        console.error('Sign up error:', error)
        // If email auth is disabled, show helpful message
        if (error.message?.includes('invalid') || error.message?.includes('disabled')) {
          throw new Error('Email authentication is currently disabled. Please contact support or try again later.')
        }
        throw new Error(error.message || 'Unable to sign up')
      }
      
      setSuccess('Account created successfully! You can now sign in.')
      setMode('sign-in')
    } catch (e: any) {
      console.error('Sign up failed:', e)
      setError(e.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    setLoading(true)
    try {
      setError('')
      setSuccess('')
      console.log('Attempting password reset for:', email)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      if (error) {
        console.error('Reset error:', error)
        throw new Error(error.message || 'Unable to send reset email')
      }
      
      setSuccess('Password reset email sent! Check your inbox.')
      setMode('sign-in')
    } catch (e: any) {
      console.error('Reset failed:', e)
      setError(e.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent animate-pulse"></div>
      <div className="absolute top-10 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-purple-200">Sign in to access your vendor dashboard</p>
        </div>
        
        <Card className="w-full max-w-md mx-auto backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${mode==='sign-in' ? 'bg-white/20 text-white border-white/30' : 'text-purple-200 border-white/20 hover:bg-white/10'}`}
                onClick={() => { setMode('sign-in'); setError(''); setSuccess('') }}
                disabled={loading}
              >
                Sign In
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${mode==='sign-up' ? 'bg-white/20 text-white border-white/30' : 'text-purple-200 border-white/20 hover:bg-white/10'}`}
                onClick={() => { setMode('sign-up'); setError(''); setSuccess('') }}
                disabled={loading}
              >
                Create Account
              </button>
            </div>
            <CardTitle className="text-white text-2xl">
              {mode === 'sign-in' ? 'Sign In' : mode === 'sign-up' ? 'Create Account' : 'Reset Password'}
            </CardTitle>
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
                type="email" 
                placeholder="Email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-purple-400"
              />
              {!isEmailValid && email.length > 0 && (
                <p className="text-xs text-red-300">Enter a valid email address</p>
              )}
            </div>
            {mode !== 'reset' && (
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="Password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-purple-400"
                />
                {!isPasswordValid && password.length > 0 && (
                  <p className="text-xs text-red-300">Password must be at least 8 characters</p>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button 
                onClick={mode==='sign-in' ? signIn : mode==='sign-up' ? signUp : resetPassword}
                disabled={!canSubmit} 
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                {loading ? 
                  (mode==='sign-in' ? 'Signing in...' : mode==='sign-up' ? 'Creating...' : 'Sending...') : 
                  (mode==='sign-in' ? 'Sign In' : mode==='sign-up' ? 'Create Account' : 'Send Reset Email')
                }
              </Button>
            </div>
            <div className="text-center space-y-2">
              {mode === 'sign-in' && (
                <>
                  <p className="text-purple-200 text-sm">Don't have an account? Switch to Create Account.</p>
                  <button 
                    className="text-purple-300 hover:text-white text-sm underline transition-colors"
                    onClick={() => { setMode('reset'); setError(''); setSuccess('') }}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </>
              )}
              {mode === 'sign-up' && (
                <p className="text-purple-200 text-sm">Already have an account? Switch to Sign In.</p>
              )}
              {mode === 'reset' && (
                <button 
                  className="text-purple-300 hover:text-white text-sm underline transition-colors"
                  onClick={() => { setMode('sign-in'); setError(''); setSuccess('') }}
                  disabled={loading}
                >
                  Back to Sign In
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}