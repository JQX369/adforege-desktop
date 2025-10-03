// Test script to verify Supabase auth configuration
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Testing Supabase auth configuration...')
console.log('URL:', supabaseUrl ? 'present' : 'missing')
console.log('Anon Key:', supabaseAnonKey ? 'present' : 'missing')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testAuth() {
  try {
    console.log('\n1. Testing sign up...')
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'testvendor@example.com',
      password: 'testpassword123'
    })
    
    if (signUpError) {
      console.log('Sign up error (expected for existing user):', signUpError.message)
    } else {
      console.log('Sign up successful:', signUpData.user?.id)
    }

    console.log('\n2. Testing sign in...')
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'testvendor@example.com', 
      password: 'testpassword123'
    })

    if (signInError) {
      console.error('Sign in error:', signInError.message)
      return false
    } else {
      console.log('Sign in successful:', signInData.user?.id)
      console.log('Session valid:', !!signInData.session)
      return true
    }
  } catch (error) {
    console.error('Auth test failed:', error.message)
    return false
  }
}

testAuth().then(success => {
  console.log('\nAuth test result:', success ? 'PASSED' : 'FAILED')
  process.exit(success ? 0 : 1)
})
