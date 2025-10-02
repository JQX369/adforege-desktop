# Current Environment Variables Setup

## Database
- `DATABASE_URL`: PostgreSQL connection string (configured ✓)

## Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: https://pjuvkxsof...supabase.co (configured ✓)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: eyJhbGc... (configured ✓)
- `SUPABASE_SERVICE_ROLE_KEY`: eyJhbGc... (configured ✓)

## OpenAI
- `OPENAI_API_KEY`: sk-proj... (configured ✓)

## Stripe
- `STRIPE_SECRET_KEY`: sk_live... (configured ✓)
- `STRIPE_PUBLISHABLE_KEY`: pk_live... (configured ✓)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: pk_live... (configured ✓)
- `STRIPE_WEBHOOK_SECRET`: whsec... (configured ✓)

## Stripe Price IDs (Subscription Tiers)
- `STRIPE_PRICE_BASIC`: prod_SsXYuqx29uA2A9 (configured ✓)
- `STRIPE_PRICE_FEATURED`: prod_SsXYQALhOmVZmB... (configured ✓)
- `STRIPE_PRICE_PREMIUM`: prod_SsXZnjSyD0zqq5 (configured ✓)

## Other
- `NEXT_PUBLIC_ETSY_ID`: (configured ✓)
- `PERPLEXITY_API_KEY`: pplx... (configured ✓)
 - `NEXT_PUBLIC_AMZ_TAG`: your-amazon-tag (recommended)
 - `AFFILIATE_ALLOWED_DOMAINS`: comma list (defaults to Amazon + amzn.to)
 - `AFFILIATE_REQUIRE_ALLOWED`: true|false (default true)
 - `INGEST_ADMINS`: comma-separated admin emails for ingest API
- `CRON_SECRET`: random string for securing Vercel cron jobs
- `RAINFOREST_API_KEY`: API key for Rainforest Amazon Data API (backup provider)
- `EBAY_APP_ID` (or `EBAY_CLIENT_ID`) and `EBAY_OAUTH_TOKEN`: eBay Browse API auth
- `EBAY_CAMPAIGN_ID`: eBay Partner Network campaign id (for affiliate params)

## Status
All environment variables are properly configured. The app should use real Supabase and Stripe, not demo mode.

## Optional tools
- Nightly refresh: runs via Vercel cron (`vercel.json` configured for 2 AM UTC)
- Bookmarklet: create a bookmark with URL `javascript:(function(){var s=document.createElement('script');s.src=location.origin+'/bookmarklet.js';document.body.appendChild(s);})();`
