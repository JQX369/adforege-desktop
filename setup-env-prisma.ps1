# Setup script for AI Gift Finder environment variables
# Creates both .env (for Prisma) and .env.local (for Next.js)

$envContent = @"
# Database
DATABASE_URL=""

# Supabase
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY="" # You'll need this from Supabase dashboard

# OpenAI
OPENAI_API_KEY="" # You'll need this from OpenAI

# Stripe
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# Affiliate Programs
NEXT_PUBLIC_AMZ_TAG=""
NEXT_PUBLIC_ETSY_ID="" # Optional - you mentioned AWIN coming soon
"@

# Write to both .env and .env.local
Set-Content -Path ".env" -Value $envContent -Encoding UTF8
Set-Content -Path ".env.local" -Value $envContent -Encoding UTF8

Write-Host "Created .env and .env.local files" -ForegroundColor Green 