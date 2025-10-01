# Railway Full Stack Deployment (Dashboard + Workers)

## 🎯 Single Platform Deployment

This guide deploys **everything** to Railway:
- ✅ Next.js Dashboard (browse at `/dashboard`)
- ✅ All 17 BullMQ workers (background processing)
- ✅ API endpoints (metrics, orders, etc.)
- ✅ Single deployment, single set of environment variables

**No Vercel needed!**

---

## Prerequisites

You confirmed you have:
- ✅ Supabase (database connected)
- ✅ Redis Cloud (cloud.redislabs.com)
- ✅ Gemini API key
- ✅ OpenAI API key

You need to add:
- [ ] Supabase Storage bucket (for images/PDFs)
- [ ] Auth secrets (JWT_SECRET, ADMIN_API_TOKEN)
- [ ] Google Drive credentials (optional - can skip for now)

---

## Step 1: Supabase Storage Setup (10 minutes)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Storage** → **Create a new bucket**
   - Name: `kcs-assets`
   - Public bucket: ✅ **Yes** (so generated URLs are accessible)
4. Go to **Settings** → **API**
   - Copy your **Service Role Key** (secret)
   - Copy your **Project URL** (e.g., `https://abc123.supabase.co`)

**Add to your `.env` file:**
```bash
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

---

## Step 2: Generate Auth Secrets (2 minutes)

Run these commands in PowerShell:

```powershell
# Generate JWT Secret
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Generate Admin Token
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Or use online generator: https://randomkeygen.com/ (use "Fort Knox Passwords")

**Add to `.env`:**
```bash
JWT_SECRET=your-generated-jwt-secret-here
ADMIN_API_TOKEN=your-generated-admin-token-here
```

---

## Step 3: Run Database Migrations (5 minutes)

From your project root:

```bash
# Ensure you're in the right directory
cd "C:\Users\Jacques Y\Desktop\KCS Automation End to End"

# Generate Prisma Client
pnpm --filter @kcs/db exec prisma generate

# Run migrations against Supabase
pnpm --filter @kcs/db exec prisma migrate deploy

# Seed default print configurations
pnpm --filter @kcs/db exec tsx prisma/seed-print-config.ts
```

**Expected output:**
```
✔ All migrations have been applied
Seeding print configurations...
  ✓ Created default print config for 3-4
  ✓ Created default print config for 4-6
  ✓ Created default print config for 6-7
  ✓ Created default print config for 8
```

---

## Step 4: Create Railway Project (5 minutes)

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub
5. Select repository: `KCS Automation End to End`
6. Railway will detect `railway.json` automatically

---

## Step 5: Configure Environment Variables (15 minutes)

In Railway project → **Variables** tab, add ALL of these:

### Database & Redis
```bash
DATABASE_URL=postgresql://postgres.[your-project]:[password]@...supabase.co:5432/postgres

REDIS_HOST=redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com
REDIS_PORT=16379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=true
```

### Authentication
```bash
JWT_SECRET=your-generated-secret-from-step2
ADMIN_API_TOKEN=your-generated-token-from-step2
```

### AI Providers
```bash
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
```

### Storage (Supabase)
```bash
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-from-step1
```

### Application Settings
```bash
NODE_ENV=production
PORT=3000
QUEUE_CONCURRENCY=5
LLM_PROVIDER_PRIMARY=gemini-flash
LLM_PROVIDER_FALLBACK=gpt4o
LOG_LEVEL=info
METRICS_ENABLED=true
```

### Optional (Skip for now)
```bash
# Google Drive - Add later when needed
# GOOGLE_DRIVE_CREDENTIALS_JSON={"type":"service_account",...}
```

---

## Step 6: Update Railway Configuration

Railway needs to use our full-stack Dockerfile. Update `railway.json`:

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">railway.json
