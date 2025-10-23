const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  console.log('Testing sign up...')
  const { data, error } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'password123',
  })

  if (error) {
    console.log('Error:', error.message)
  } else {
    console.log('Success:', data.user?.email)
  }
}

test()
