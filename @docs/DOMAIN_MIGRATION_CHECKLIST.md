# 🌐 Domain Migration Checklist

**Purpose:** Track every place that needs to be updated when the primary domain changes (e.g., staging → production, rebrand, URL change).

---

## ✅ Immediate Updates

- **Vercel project settings**
  - Add new domain in Vercel dashboard
  - Set primary domain & remove old one when ready
  - Update `vercel.json` 
    - `rewrites`, `redirects`, `crons`, `headers`
  - Re-run `vercel --prod`

- **Environment variables (.env / Vercel)**
  - `NEXT_PUBLIC_SITE_URL`
  - Any API callback URLs (Stripe, Supabase, auth providers, etc.)
  - Analytics endpoints (Plausible, GA4) if domain-specific

- **Third-party platforms**
  - Stripe webhook endpoints
  - Supabase redirect URLs
  - OpenAI / Rainforest / eBay dashboards (if domain-specific usage tracking)
  - Social login providers (Google, Apple, etc.)

---

## 🧭 OAuth & API Callbacks

- **eBay Developer Portal**
  - Update OAuth Redirect URI (a.k.a. RuName)
  - Update app domains and contact info
  - Regenerate credentials if necessary

- **Google OAuth**
  - Update Authorized JavaScript Origins
  - Update Authorized Redirect URIs

- **Other providers**
  - Check each provider’s “App Settings” for redirect or webhook domains

---

## 🗺️ Codebase References

- Update any hard-coded URLs
  - `app/api/ebay/callback/route.ts` (callback path comment)
  - `app/api/r/route.ts` or redirect shorteners (if domain-specific)
  - Email templates with absolute URLs
  - Sitemap and RSS feeds (`/sitemap.xml`, `/feed.xml`)

- Confirm image loaders / `next.config.js` domain allowlists

---

## 🧪 Testing & Validation

- **Local**
  - Update `.env.local` and restart dev server
  - Verify OAuth flow locally (use `https://localhost:3000/api/ebay/callback` and trust cert)

- **Staging**
  - Deploy to staging with new domain
  - Run smoke tests (forms, payments, auth, vendor onboarding)

- **Production**
  - Verify SSL certificate issued (HTTPS)
  - Run `npm run ingest:test` and ensure callbacks succeed
  - Monitor error logs for 24 hours post-migration

---

## 📌 Post-Migration Tasks

- Update documentation
  - `README.md`
  - `docs/CURRENT_ENV_SETUP.md`
  - Marketing sites, Notion, internal wikis

- Notify partners & integrations
  - Affiliate networks (Amazon, eBay, Etsy, etc.)
  - Vendors and internal stakeholders

- Submit to search engines (if public-facing)
  - Google Search Console → Change of Address
  - Update sitemap submissions

---

## 📝 Notes

- Keep old domain alive with 301 redirects for at least 30 days
- Monitor analytics for traffic drops or OAuth failures
- Schedule migration during low-traffic window when possible

---

**Last updated:** YYYY-MM-DD  _(Update this when procedures change)_
