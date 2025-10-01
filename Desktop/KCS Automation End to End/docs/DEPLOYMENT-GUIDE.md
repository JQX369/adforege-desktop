# KCS Automation - Complete Deployment Guide

## 🎯 Overview

This guide walks you through deploying the full KCS Automation stack:
- **Vercel**: Dashboard UI + read-only APIs
- **Railway**: 17 BullMQ workers (background processing)
- **Supabase**: PostgreSQL database  
- **Redis Cloud**: Job queue (cloud.redislabs.com)
- **Cloudflare R2**: Object storage (images, PDFs)

**Total time**: 1-2 hours (if all credentials ready)

---

## ✅ Pre-Deployment Checklist

### Accounts & Services

- [ ] **Supabase**: Database connected (you confirmed ✅)
- [ ] **Redis Cloud**: Connected at cloud.redislabs.com (you confirmed ✅)
- [ ] **Gemini API Key**: Ready (you confirmed ✅)
- [ ] **OpenAI API Key**: Ready (you confirmed ✅)
- [ ] **Google Drive**: Service account JSON needed ⚠️
- [ ] **Cloudflare R2** OR **Supabase Storage**: Choose one for assets
- [ ] **Vercel Account**: For dashboard deployment
- [ ] **Railway Account**: For worker deployment

### Files Created (by AI)

- [x] `env.example` - Environment variable template
- [x] `apps/api/vercel.json` - Vercel configuration
- [x] `apps/api/Dockerfile` - Worker container definition
- [x] `apps/api/workers/start.ts` - Worker startup script
- [x] `railway.json` - Railway configuration
- [x] `docs/DATABASE-SETUP.md` - Database migration guide
- [x] `docs/RAILWAY-DEPLOYMENT.md` - Worker deployment guide
- [x] `packages/shared/assets/` - Assets bundled (ICC profile + overlays)

---

## 📋 Deployment Steps

### Step 1: Database Setup (10 minutes)

Your Supabase is connected, now run migrations:

```bash
# From project root
cd "C:\Users\Jacques Y\Desktop\KCS Automation End to End"

# Generate Prisma Client
pnpm --filter @kcs/db exec prisma generate

# Run migrations
pnpm --filter @kcs/db exec prisma migrate deploy

# Seed default print configs
pnpm --filter @kcs/db exec tsx prisma/seed-print-config.ts
```

**Verify**: 
```bash
pnpm --filter @kcs/db exec prisma studio
# Check PrintConfig table has 4 records
```

📖 Full instructions: `docs/DATABASE-SETUP.md`

---

### Step 2: Object Storage Setup (15 minutes)

Choose **ONE** option:

#### Option A: Cloudflare R2 (Recommended - Free 10GB)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create bucket: `kcs-production-assets`
3. Go to **Manage R2 API Tokens** → Create API Token
4. Copy:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL

Add to `.env`:
```bash
STORAGE_PROVIDER=r2
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_BUCKET=kcs-production-assets
STORAGE_REGION=auto
STORAGE_ENDPOINT=https://...r2.cloudflarestorage.com
```

#### Option B: Supabase Storage (If using Supabase)

1. Go to Supabase Dashboard → Storage
2. Create bucket: `kcs-assets`
3. Make bucket public (for generated URLs)
4. Copy service role key from Settings → API

Add to `.env`:
```bash
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

---

### Step 3: Google Drive Setup (15 minutes)

For print handoff integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "KCS Automation"
3. Enable **Google Drive API**
4. Create **Service Account**:
   - IAM & Admin → Service Accounts → Create
   - Name: "kcs-print-handoff"
   - Grant role: None needed
5. Create key (JSON format) → Download
6. Copy entire JSON content (single line)

Add to `.env`:
```bash
GOOGLE_DRIVE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

7. Share target Google Drive folder with service account email:
   - `kcs-print-handoff@your-project.iam.gserviceaccount.com`
   - Permission: Editor

---

### Step 4: Vercel Dashboard Deployment (20 minutes)

1. **Install Vercel CLI** (if not already):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from `apps/api` directory**:
   ```bash
   cd apps/api
   vercel
   ```

   Follow prompts:
   - Link to existing project? **No**
   - Project name: `kcs-automation-dashboard`
   - Directory: `apps/api`
   - Override settings? **No**

4. **Configure Environment Variables** in Vercel Dashboard:
   
   Go to Project → Settings → Environment Variables
   
   Add ALL variables from `env.example`:
   ```
   DATABASE_URL=...
   REDIS_HOST=...
   REDIS_PORT=...
   REDIS_PASSWORD=...
   REDIS_TLS=true
   GEMINI_API_KEY=...
   OPENAI_API_KEY=...
   JWT_SECRET=... (generate: openssl rand -base64 32)
   ADMIN_API_TOKEN=... (generate: openssl rand -hex 32)
   STORAGE_PROVIDER=...
   (+ storage credentials based on choice above)
   GOOGLE_DRIVE_CREDENTIALS_JSON=...
   NODE_ENV=production
   LLM_PROVIDER_PRIMARY=gemini-flash
   LLM_PROVIDER_FALLBACK=gpt4o
   QUEUE_CONCURRENCY=5
   ```

5. **Redeploy**:
   ```bash
   vercel --prod
   ```

6. **Verify**:
   - Open: `https://kcs-automation-dashboard.vercel.app/dashboard`
   - Should see dashboard (even if no data yet)
   - Check: `https://...vercel.app/api/metrics` returns 200

---

### Step 5: Railway Worker Deployment (30 minutes)

1. **Create Railway Project**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - New Project → Deploy from GitHub
   - Select your repository
   - Railway auto-detects `railway.json` and `Dockerfile`

2. **Configure Environment Variables**:
   
   In Railway project → Variables tab, add **ALL** variables from Step 4 above.
   
   **Critical**: Railway workers need ALL variables (database, Redis, APIs, storage).

3. **Deploy**:
   Railway will automatically:
   - Build Docker image
   - Start 17 workers
   - Expose health check

4. **Monitor Deployment**:
   - Deployments tab → View Logs
   - Look for:
     ```
     🚀 KCS Automation Worker Service Starting...
     📦 Loaded 17 workers
     ✨ All workers initialized and ready!
     ```

5. **Verify Health**:
   ```bash
   curl https://your-railway-app.railway.app/api/health
   ```
   
   Should return:
   ```json
   {
     "status": "healthy",
     "workers": 17,
     "uptime": 45.2
   }
   ```

📖 Full instructions: `docs/RAILWAY-DEPLOYMENT.md`

---

### Step 6: End-to-End Test (15 minutes)

Create a test order to verify the full pipeline:

```bash
# Set your admin token
export ADMIN_TOKEN="your-admin-api-token"

# Create test order
curl -X POST https://kcs-automation-dashboard.vercel.app/api/partner/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "partnerSlug": "test-partner",
    "customerEmail": "test@example.com",
    "productSku": "storybook-8x8",
    "brief": {
      "child": { "first_name": "Test", "age": 5 },
      "interests": "space adventure"
    }
  }'
```

Monitor progress:
1. **Railway Logs**: Watch workers process jobs
   ```
   [story.profile] Processing order...
   [story.cover] Generating cover images...
   [story.handoff] Upload complete!
   ```

2. **Vercel Dashboard**: Refresh `/dashboard/print-pipeline`
   - Should show order status progressing
   - Cover images appear as generated
   - Inside book PDF link when complete

3. **Redis Queues** (optional):
   ```bash
   redis-cli -h cloud.redislabs.com -p ... -a ... --tls
   LLEN bull:story.cover:waiting
   LLEN bull:story.cover:active
   ```

**Expected timeline**: 
- Order → Analysis: 30s
- Story generation: 2-3 minutes  
- Image generation: 3-5 minutes (depends on Gemini API)
- Assembly + handoff: 1-2 minutes
- **Total**: ~7-10 minutes for complete order

---

## 🔍 Verification Checklist

After deployment, verify each component:

### Database
- [ ] Migrations applied successfully
- [ ] 4 PrintConfig records exist (3-4, 4-6, 6-7, 8)
- [ ] Can connect from Vercel (dashboard loads)
- [ ] Can connect from Railway (workers start)

### Vercel Dashboard
- [ ] Deployed successfully (green status)
- [ ] `/dashboard` loads without errors
- [ ] `/dashboard/orders` shows empty state or test data
- [ ] `/dashboard/print-pipeline` renders
- [ ] `/api/metrics` returns Prometheus metrics

### Railway Workers
- [ ] Build succeeded (check Deployments tab)
- [ ] All 17 workers logged as initialized
- [ ] Health endpoint returns `{"status":"healthy"}`
- [ ] No errors in logs after 5 minutes
- [ ] Memory usage stable (~50-100MB idle)

### Object Storage
- [ ] Bucket/folder created
- [ ] Credentials configured in both Vercel + Railway
- [ ] Test upload succeeds (try cover generation)
- [ ] Generated URLs accessible (not 403/404)

### AI APIs
- [ ] Gemini API key works (test image generation)
- [ ] OpenAI API key works (test story generation)
- [ ] No rate limit errors in first test
- [ ] API usage shows in provider dashboards

### Google Drive
- [ ] Service account JSON configured
- [ ] Target folder shared with service account
- [ ] Test upload succeeds (print handoff worker)
- [ ] Files visible in Drive folder

---

## 🚨 Common Issues

### Issue: Vercel build fails with "Cannot find module '@kcs/db'"

**Cause**: Turb orepo monorepo build order
**Fix**: Update `vercel.json` buildCommand:
```json
"buildCommand": "cd ../.. && pnpm install && pnpm --filter @kcs/db exec prisma generate && pnpm --filter api build"
```

### Issue: Railway workers crash with "Out of memory"

**Cause**: Too many concurrent jobs for 512MB RAM
**Fix**: Lower `QUEUE_CONCURRENCY=3` in Railway env vars, then restart

### Issue: "Redis connection refused"

**Cause**: TLS settings or wrong host
**Fix**: Verify in Railway/Vercel:
```
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=true
```

### Issue: "Gemini API rate limit exceeded"

**Cause**: Free tier limit (15 RPM)
**Fix**: 
- Lower `QUEUE_CONCURRENCY=2`
- Or upgrade to Gemini Pro (paid tier)

### Issue: Dashboard loads but no data

**Not an issue!** If no orders created yet, dashboard shows empty state. Create test order (Step 6).

---

## 💰 Cost Summary

### Free Tier (Perfect for testing)

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| Supabase | 500MB DB, 1GB storage | $0 → $25/month (Pro) |
| Redis Cloud | 30MB | $0 → $5/month (Standard) |
| Railway | 500 exec hrs/month | $0 → $0.000463/hr (~$3/wk) |
| Vercel | Unlimited deploys | $0 → $20/month (Pro) |
| Cloudflare R2 | 10GB storage | $0 → $0.015/GB/month |
| Gemini API | 15 RPM free tier | $0 → varies (Pro) |
| OpenAI API | Pay-as-you-go | ~$10-20/month (light usage) |
| **TOTAL** | **~$10-20/month** | (Only OpenAI is pay-as-go) |

### Production Scale (100 orders/month)

- OpenAI: ~$50-100/month
- Railway: ~$20-30/month (if exceeding 500hr)
- Others: Still free tier
- **Total**: ~$70-130/month

---

## 📚 Documentation Index

- **`env.example`** - All environment variables explained
- **`docs/DATABASE-SETUP.md`** - Supabase setup + migrations
- **`docs/RAILWAY-DEPLOYMENT.md`** - Worker service detailed guide  
- **`docs/DEPLOYMENT-READINESS.md`** - Pre-deployment checklist
- **`README.md`** - Phase 6 print pipeline specs

---

## 🎉 Success Criteria

Deployment is complete when:

- ✅ Vercel dashboard accessible at your `.vercel.app` URL
- ✅ Railway health check returns `{"status":"healthy"}`
- ✅ Test order progresses through all 17 workers
- ✅ Cover + interior PDFs generated successfully
- ✅ Print handoff uploads to Google Drive
- ✅ `/dashboard/print-pipeline` shows completed order
- ✅ No errors in Railway logs for 24 hours

---

## 🚀 Next Steps

After successful deployment:

1. **Monitor for 24 hours**: Check Railway logs for errors
2. **Setup uptime monitoring**: UptimeRobot for health checks
3. **Configure alerts**: Railway → Notifications (email on failure)
4. **Create first real order**: From partner integration
5. **Document partner webhook setup**: For order creation
6. **Archive legacy Python pipeline**: Move to separate repo

---

## ❓ Need Help?

**Check logs first:**
- Railway: Dashboard → Deployments → View Logs
- Vercel: Dashboard → Deployments → Function Logs

**Common commands:**
```bash
# Railway CLI (install: npm i -g @railway/cli)
railway login
railway logs

# Vercel CLI
vercel logs

# Redis CLI (check queues)
redis-cli -h cloud.redislabs.com -p 16379 -a password --tls
LLEN bull:story.cover:waiting

# Database (check data)
pnpm --filter @kcs/db exec prisma studio
```

**If stuck, check:**
1. All environment variables match between Vercel + Railway
2. Database migrations ran successfully  
3. Redis connection works from both platforms
4. API keys are valid (test in provider dashboards)
5. Storage bucket is accessible (check credentials)

---

**You're almost there!** Follow the steps above and you'll have a fully operational KCS Automation pipeline. 🎨📚✨

