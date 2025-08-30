# Complete setup script for AI Gift Finder with all credentials

$envContent = @"
# Database
DATABASE_URL=""

# Supabase
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""

# OpenAI
OPENAI_API_KEY=""

# Stripe
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# Affiliate Programs
NEXT_PUBLIC_AMZ_TAG=""
NEXT_PUBLIC_ETSY_ID=""
"@

# Write to both .env and .env.local
Set-Content -Path ".env" -Value $envContent -Encoding UTF8
Set-Content -Path ".env.local" -Value $envContent -Encoding UTF8

Write-Host "Successfully updated .env and .env.local with all credentials!" -ForegroundColor Green
Write-Host ""
Write-Host "All API keys are now configured. You can run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "to start your application!" -ForegroundColor Cyan 