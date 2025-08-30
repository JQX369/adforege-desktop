const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testCredentials() {
  console.log("Testing credentials for vendor@thegiftaunty.com...")
  
  // First try sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: "vendor@thegiftaunty.com",
    password: "SecurePass123!"
  })
  
  if (signInError) {
    console.log("Sign in failed:", signInError.message)
    
    // Try to create the user first
    console.log("Attempting to create user...")
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: "vendor@thegiftaunty.com", 
      password: "SecurePass123!"
    })
    
    if (signUpError) {
      console.log("Sign up failed:", signUpError.message)
    } else {
      console.log("User created:", signUpData.user?.email)
      
      // Try sign in again
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email: "vendor@thegiftaunty.com",
        password: "SecurePass123!"
      })
      
      if (retryError) {
        console.log("Retry sign in failed:", retryError.message)
      } else {
        console.log("Sign in successful after creation:", retryData.user?.email)
      }
    }
  } else {
    console.log("Sign in successful:", signInData.user?.email)
  }
}

testCredentials()
