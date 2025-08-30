const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  console.log("Testing with valid email...")
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: "vendor@thegiftaunty.com",
    password: "SecurePass123!"
  })
  
  if (signUpError) {
    console.log("Sign up:", signUpError.message)
  } else {
    console.log("Sign up successful:", signUpData.user?.email)
  }
  
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: "vendor@thegiftaunty.com",
    password: "SecurePass123!"
  })
  
  if (signInError) {
    console.log("Sign in:", signInError.message)
  } else {
    console.log("Sign in successful:", signInData.user?.email)
  }
}

test()
