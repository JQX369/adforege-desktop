# Setup script for AI Gift Finder environment variables

# Create .env.local file
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

# Write to .env.local
Set-Content -Path ".env.local" -Value $envContent -Encoding UTF8

Write-Host "Created .env.local file with your credentials" -ForegroundColor Green
Write-Host ""
Write-Host "You still need to add:" -ForegroundColor Yellow
Write-Host "1. OPENAI_API_KEY - Get from https://platform.openai.com/api-keys" -ForegroundColor Yellow
Write-Host "2. SUPABASE_SERVICE_ROLE_KEY - Get from Supabase dashboard > Settings > API" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Add the missing API keys to .env.local" -ForegroundColor Cyan
Write-Host "2. Run: npx prisma generate" -ForegroundColor Cyan
Write-Host "3. Run: npx prisma migrate dev" -ForegroundColor Cyan
Write-Host "4. Run: npm run dev" -ForegroundColor Cyan 