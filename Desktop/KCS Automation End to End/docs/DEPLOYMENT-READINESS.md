# KCS Automation - Deployment Readiness Report

**Date**: October 1, 2025  
**Status**: ⚠️ **BLOCKED** - Awaiting infrastructure decisions  
**Phase 6**: ✅ Complete (Full print pipeline operational in dev)  
**Phase 7**: 📋 Planned (10 deployment tasks defined)

---

## 🚦 Current State

### ✅ What's Ready
- [x] Full print pipeline (17 workers operational)
- [x] Dashboard UI (`/dashboard/*` pages)
- [x] Database schema with migrations
- [x] Redis integration configured
- [x] Print configuration system
- [x] Real AI provider integrations (Gemini, OpenAI)
- [x] Google Drive + webhook handoff
- [x] PDF generation with CMYK conversion
- [x] Prometheus metrics endpoint

### ❌ What's Missing
- [ ] Production database provisioned
- [ ] Worker hosting platform selected
- [ ] Object storage bucket created
- [ ] 13 environment variables (beyond Redis)
- [ ] API keys obtained (Gemini, OpenAI, Google Drive)
- [ ] Asset bundling for production
- [ ] Worker startup orchestration script
- [ ] Vercel deployment configuration
- [ ] End-to-end testing on production stack

---

## 🏗️ Recommended Architecture

### **Hybrid Deployment** (Option A - RECOMMENDED)

```
┌─────────────────┐         ┌─────────────────┐
│  VERCEL         │         │  RAILWAY/RENDER │
│                 │         │                 │
│  Dashboard UI   │◄────────┤  17 Workers     │
│  /dashboard/*   │  Redis  │  BullMQ Pool    │
│  Read-only APIs │         │  Write APIs     │
└─────────────────┘         └─────────────────┘
        │                           │
        │                           │
        ▼                           ▼
┌─────────────────────────────────────────────┐
│  SHARED INFRASTRUCTURE                      │
│  • Postgres (Supabase/Vercel/Neon)         │
│  • Redis (Upstash/Railway)                  │
│  • Object Storage (R2/Supabase/S3)          │
│  • AI APIs (Gemini, OpenAI)                 │
└─────────────────────────────────────────────┘
```

**Why this approach?**
- ✅ Minimal refactoring (2-3 hours vs 3-5 days for full serverless)
- ✅ Workers run continuously, process jobs immediately
- ✅ Vercel handles dashboard auto-scaling
- ✅ Clear separation of concerns
- ❌ Requires managing two deployments

---

## 📋 Deployment Tasks (Phase 7)

| Task | Description | Duration | Dependencies |
|------|-------------|----------|--------------|
| 7.1 | Environment documentation & setup | 1 hour | None |
| 7.2 | Asset bundling (ICC profiles, overlays) | 2 hours | Task 7.1 |
| 7.3 | Database provisioning & migrations | 1 hour | Task 7.1 |
| 7.4 | Vercel dashboard deployment | 2 hours | Task 7.1, 7.3 |
| 7.5 | Worker service deployment | 3 hours | Task 7.1, 7.2, 7.3 |
| 7.6 | Storage configuration | 1 hour | Task 7.1 |
| 7.7 | API integration verification | 2 hours | Task 7.1 |
| 7.8 | End-to-end smoke test | 2 hours | Tasks 7.4-7.7 |
| 7.9 | Monitoring & alerting setup | 2 hours | Task 7.8 |
| 7.10 | Documentation & handoff | 1 hour | Task 7.9 |

**Total estimated time**: 
- Minimal (Dashboard only): **2-3 hours**
- Full deployment: **1-2 days**
- Production-ready: **3-4 days**

---

## 🔑 Required Environment Variables (15 total)

### Currently Missing

```bash
# Database
DATABASE_URL=postgresql://...                    # ❌ REQUIRED

# Redis (✅ User has added these)
REDIS_HOST=...
REDIS_PORT=...
REDIS_PASSWORD=...
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=true

# Authentication
JWT_SECRET=...                                   # ❌ REQUIRED
ADMIN_API_TOKEN=...                              # ❌ REQUIRED

# AI Providers (CRITICAL - Workers will fail without these)
GEMINI_API_KEY=...                               # ❌ REQUIRED
OPENAI_API_KEY=...                               # ❌ REQUIRED

# Google Drive (for print handoff)
GOOGLE_DRIVE_CREDENTIALS_JSON={"type":...}       # ❌ REQUIRED

# Storage (for generated assets)
STORAGE_PROVIDER=s3|r2|supabase                  # ❌ REQUIRED
STORAGE_ACCESS_KEY=...                           # ❌ REQUIRED
STORAGE_SECRET_KEY=...                           # ❌ REQUIRED
STORAGE_BUCKET=...                               # ❌ REQUIRED
STORAGE_REGION=...                               # ❌ REQUIRED

# Queue Configuration
QUEUE_CONCURRENCY=5                              # Optional (default: 5)

# LLM Providers
LLM_PROVIDER_PRIMARY=gemini-flash                # Optional (has defaults)
LLM_PROVIDER_FALLBACK=gpt4o                      # Optional (has defaults)
```

---

## 🎯 Decision Points (USER ACTION REQUIRED)

### 1. Database Provider

| Provider | Free Tier | Pros | Cons | Recommendation |
|----------|-----------|------|------|----------------|
| **Supabase** | 500MB | Easiest setup, includes storage | Slower than managed Postgres | ⭐ **RECOMMENDED** |
| Vercel Postgres | 256MB | Vercel native, fast | Smaller free tier, costs add up | Good alternative |
| Neon | 512MB | Generous free tier | Newer platform | Solid choice |

**Your choice**: [ ] Supabase / [ ] Vercel Postgres / [ ] Neon / [ ] Other: _______

---

### 2. Worker Hosting

| Provider | Free Tier | Pros | Cons | Recommendation |
|----------|-----------|------|------|----------------|
| **Railway** | 500hrs/month | Docker deploy, great DX | Free tier limited | ⭐ **RECOMMENDED** |
| Render | 750hrs/month | More free hours | Slower cold starts | Good alternative |
| Vercel Cron | N/A | No separate deploy | Requires major refactor (3-5 days) | ❌ Not recommended now |

**Your choice**: [ ] Railway / [ ] Render / [ ] Other: _______

---

### 3. Object Storage

| Provider | Free Tier | Pros | Cons | Recommendation |
|----------|-----------|------|------|----------------|
| **Cloudflare R2** | 10GB | No egress fees, S3-compatible | Newer, fewer tools | ⭐ **RECOMMENDED** |
| Supabase Storage | 1GB | Integrated with DB | Smaller limit | Good if using Supabase |
| AWS S3 | None (pay-as-go) | Most mature | Egress costs add up | Enterprise choice |

**Your choice**: [ ] Cloudflare R2 / [ ] Supabase Storage / [ ] AWS S3 / [ ] Other: _______

---

### 4. API Keys Status

**Do you have the following API keys ready?**

- [ ] **Gemini API Key** ([Get it here](https://aistudio.google.com/app/apikey))
  - Used for: Image generation (Imagen 3), vision scoring, overlay positioning
  - Cost: Free tier available
  
- [ ] **OpenAI API Key** ([Get it here](https://platform.openai.com/api-keys))
  - Used for: Fallback image generation, story generation
  - Cost: Pay-as-you-go (estimate: $5-20/month)
  
- [ ] **Google Drive Service Account** ([Setup guide](https://developers.google.com/workspace/guides/create-credentials))
  - Used for: Partner print file handoff
  - Requirements: JSON credentials file

---

### 5. Redis Provider Confirmation

You mentioned adding Redis variables. Please confirm:

- **Provider**: [ ] Upstash / [ ] Railway Redis / [ ] Self-hosted / [ ] Other: _______
- **Connection limit**: _______
- **Location/Region**: _______

---

## 🚀 Quick Start Options

### Option A: Dashboard Only (Testing UI)
**Time**: 2-3 hours  
**What works**: View dashboard, see database data, metrics endpoint  
**What doesn't work**: Worker processing, job execution, image generation

**Command to proceed**:
```
Choose: Supabase (database) + Vercel (dashboard only)
Skip: Workers, storage, AI keys (for now)
```

### Option B: Full Stack (Production Ready)
**Time**: 1-2 days  
**What works**: Everything - full pipeline end-to-end  
**What doesn't work**: N/A (complete system)

**Command to proceed**:
```
Choose: All infrastructure providers above
Gather: All API keys
Deploy: Dashboard (Vercel) + Workers (Railway)
```

---

## ⚡ Next Steps

### Immediate Actions

1. **Fill out decision points** above (check boxes for your choices)
2. **Gather API keys** (Gemini, OpenAI, Google Drive)
3. **Create accounts** for chosen providers (Supabase, Railway, R2)
4. **Reply with**: Your infrastructure choices + confirmation you have API keys

### Then Tell AI Agent:

> "Executor mode: I've chosen [DATABASE] + [WORKERS] + [STORAGE]. I have all API keys ready. Please begin Phase 7 deployment starting with Task 7.1."

---

## 📊 Cost Estimates (Free Tier)

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| Supabase (Database) | **$0** | Up to 500MB, 2GB transfer |
| Railway (Workers) | **$0** | 500 execution hours, then $0.000463/hr |
| Cloudflare R2 (Storage) | **$0** | 10GB storage, no egress fees |
| Upstash Redis | **$0** | 10K commands/day |
| Vercel (Dashboard) | **$0** | Hobby tier unlimited |
| Gemini API | **$0** | 15 RPM free tier |
| OpenAI API | **~$10-20** | Pay-as-you-go (estimate) |
| **TOTAL** | **~$10-20/month** | (OpenAI only paid service) |

**At scale** (100 orders/month):
- OpenAI: ~$50-100/month
- Railway: ~$20-30/month (if exceeding free tier)
- Storage: Still free (under 10GB)
- **Total**: ~$70-130/month

---

## 🎯 Success Criteria

Deployment is complete when:
- ✅ Dashboard loads at `https://your-app.vercel.app/dashboard`
- ✅ Test order progresses through all 17 workers
- ✅ Cover + interior PDFs generated successfully
- ✅ Metrics endpoint shows worker activity
- ✅ No errors in worker logs for 24 hours
- ✅ Smoke test completes end-to-end in <5 minutes

---

## 📞 Support Resources

- **Deployment plan details**: See `.cursor/scratchpad.md` Phase 7
- **Current blockers**: Infrastructure decisions + API keys
- **Estimated unblock time**: 1-2 hours (if API keys ready)
- **Full deployment ETA**: 1-2 days after decisions made

---

**Ready to proceed?** Make your infrastructure choices above and reply to the AI agent in Executor mode! 🚀

