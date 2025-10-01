# Railway Worker Deployment Guide

## Overview

This guide covers deploying the KCS Automation worker service to Railway. The workers handle all background processing (image generation, story creation, CMYK conversion, PDF assembly).

**Why Railway?**
- ✅ Generous free tier (500 execution hours/month)
- ✅ Docker support (no configuration needed)
- ✅ Auto-deploy from GitHub
- ✅ Built-in metrics and logs
- ✅ Easy environment variable management

---

## Prerequisites

- Railway account ([Sign up free](https://railway.app))
- GitHub repository with this code
- Database setup complete (see `DATABASE-SETUP.md`)
- All API keys ready (Gemini, OpenAI, Google Drive)
- Redis Cloud account configured

---

## Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository: `KCS Automation End to End`
4. Railway will detect the Dockerfile automatically

---

## Step 2: Configure Environment Variables

In Railway project settings, add the following variables:

### Database & Redis

```bash
# Database (from Supabase)
DATABASE_URL=postgresql://postgres.[project]:[password]@...

# Redis (from Redis Cloud)
REDIS_HOST=redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com
REDIS_PORT=16379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=true
```

### Authentication

```bash
# Generate these with: openssl rand -base64 32
JWT_SECRET=your-generated-jwt-secret
ADMIN_API_TOKEN=your-generated-admin-token
```

### AI Providers

```bash
# Gemini API (from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIza...

# OpenAI API (from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-...

# Google Drive Service Account (JSON as single line)
GOOGLE_DRIVE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

### Object Storage

**Option A: Cloudflare R2** (Recommended)

```bash
STORAGE_PROVIDER=r2
STORAGE_ACCESS_KEY_ID=your-r2-access-key
STORAGE_SECRET_ACCESS_KEY=your-r2-secret-key
STORAGE_BUCKET=kcs-production-assets
STORAGE_REGION=auto
STORAGE_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

**Option B: Supabase Storage**

```bash
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Application Settings

```bash
NODE_ENV=production
QUEUE_CONCURRENCY=5
LLM_PROVIDER_PRIMARY=gemini-flash
LLM_PROVIDER_FALLBACK=gpt4o
LOG_LEVEL=info
METRICS_ENABLED=true
```

---

## Step 3: Deploy

Railway will automatically:
1. Build Docker image using `apps/api/Dockerfile`
2. Start workers with `node apps/api/workers/start.js`
3. Expose health check on `/api/health`
4. Assign a public domain (for health monitoring)

Monitor deployment:
- **Logs**: Railway Dashboard → Deployments → View Logs
- **Metrics**: Dashboard → Observability → CPU/Memory

Expected log output:
```
🚀 KCS Automation Worker Service Starting...
📦 Loaded 17 workers
🔗 Redis: redis-12345.cloud.redislabs.com:16379
🌍 Environment: production
💾 Memory: 45MB
  ✓ image.analysis
  ✓ story.profile
  ✓ story.outline
  [... 14 more workers ...]
✨ All workers initialized and ready!
Health check server listening on port 3000
```

---

## Step 4: Verify Workers

### Check Health Endpoint

```bash
curl https://your-railway-app.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "workers": 17,
  "uptime": 123.45,
  "memory": {
    "rss": 67108864,
    "heapTotal": 50331648,
    "heapUsed": 45678912
  },
  "health": {
    "image.analysis": { "lastActive": "2025-10-01T...", "processedCount": 5 },
    "story.profile": { "lastActive": "2025-10-01T...", "processedCount": 3 }
  }
}
```

### Monitor Redis Queues

From local machine (with Redis connection):
```bash
# Install Redis CLI
npm install -g redis-cli

# Connect to your Redis instance
redis-cli -h redis-12345.cloud.redislabs.com -p 16379 -a your-password --tls

# Check queue status
LLEN bull:image.analysis:waiting
LLEN bull:story.cover:active
```

---

## Step 5: Test End-to-End

Create a test order to verify workers process jobs:

```bash
# From Vercel dashboard or local
curl -X POST https://your-vercel-app.vercel.app/api/partner/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -d '{
    "partnerSlug": "test-partner",
    "customerEmail": "test@example.com",
    "productSku": "storybook-8x8",
    "brief": {
      "child": { "first_name": "Alex", "age": 5 },
      "interests": "space adventure"
    }
  }'
```

Monitor in Railway logs:
```
[image.analysis] Processing job abc123...
[story.profile] Processing job abc123...
[story.outline] Generating outline for Alex...
[story.cover] Generating cover images...
[story.handoff] Upload complete: order-abc123-cover.pdf
```

---

## Configuration Options

### Worker Concurrency

Control how many jobs process simultaneously:

```bash
# Lower = less memory, slower
QUEUE_CONCURRENCY=3

# Higher = faster, more memory
QUEUE_CONCURRENCY=10
```

**Recommended**: 5 for Railway's free tier (512MB RAM)

### Instance Size

Railway free tier: **512MB RAM, 1 vCPU**

If you need more:
- Go to Settings → Resources
- Upgrade to **2GB RAM** ($10/month)
- Increase `QUEUE_CONCURRENCY` to 10

### Auto-Scaling

Railway doesn't support horizontal auto-scaling on free tier. Options:
1. Upgrade to Pro plan ($20/month) for replicas
2. Monitor queue depth and manually scale
3. Use separate Railway services per worker type

---

## Monitoring & Alerts

### Railway Built-in

- **CPU Usage**: Dashboard → Metrics
- **Memory**: Dashboard → Metrics  
- **Logs**: Dashboard → Deployments → Logs
- **Uptime**: Automatic health checks every 30s

### External Monitoring (Optional)

Add UptimeRobot for health checks:
1. Create account at [UptimeRobot](https://uptimerobot.com)
2. Add HTTP monitor: `https://your-app.railway.app/api/health`
3. Alert interval: 5 minutes
4. Notification: Email/Slack

---

## Troubleshooting

### Workers not starting

**Symptom**: Health check returns 503
**Causes**:
- Missing environment variables (check Railway logs)
- Redis connection failed (verify REDIS_HOST, REDIS_PASSWORD)
- Database not accessible (check DATABASE_URL)

**Fix**:
```bash
# View logs
railway logs

# Look for error messages like:
# ❌ Error: connect ECONNREFUSED (Redis)
# ❌ Error: authentication failed (Database)
```

### Out of memory errors

**Symptom**: Workers crash with "JavaScript heap out of memory"
**Cause**: Too many concurrent jobs for available RAM

**Fix**:
1. Lower `QUEUE_CONCURRENCY` to 3
2. Or upgrade Railway instance to 2GB RAM

### Workers stuck/not processing

**Symptom**: Jobs stay in "waiting" state
**Causes**:
- Worker service not running
- Redis connection lost
- Worker crashed on specific job

**Fix**:
```bash
# Restart Railway service
railway restart

# Check specific queue
redis-cli -h ... LLEN bull:story.cover:failed

# View failed job details
redis-cli -h ... LRANGE bull:story.cover:failed 0 -1
```

### API rate limits (Gemini/OpenAI)

**Symptom**: Workers fail with "Rate limit exceeded"
**Cause**: Too many concurrent API calls

**Fix**:
- Lower `QUEUE_CONCURRENCY` to 3
- Add delays in worker code (future enhancement)
- Upgrade API tier (Gemini Pro, OpenAI Tier 2)

---

## Cost Estimation

### Free Tier

- Railway: 500 execution hours/month = **$0**
- Estimate: 20-30 days uptime on free tier
- After 500hr: $0.000463/hour (~$3.50/week)

### Paid Plans

| Workers | RAM | Hours/Month | Cost |
|---------|-----|-------------|------|
| 17 | 512MB | 720 | $0 (free tier covers 500hr) |
| 17 | 1GB | 720 | ~$15/month |
| 17 | 2GB | 720 | ~$30/month |

**Pro tip**: Railway's free tier resets monthly. Deploy on the 1st to maximize free hours!

---

## Production Checklist

- [ ] Railway project created and connected to GitHub
- [ ] All 15+ environment variables configured
- [ ] Docker build succeeded (check Deployments tab)
- [ ] Health endpoint returns 200 (`/api/health`)
- [ ] All 17 workers logged as initialized
- [ ] Test order processes end-to-end
- [ ] Redis queue depths monitored
- [ ] Uptime monitoring configured (optional)
- [ ] Log aggregation setup (optional)

---

## Next Steps

After Railway deployment:
1. Link Vercel dashboard to Railway workers (both point to same Redis)
2. Configure object storage (Cloudflare R2 or Supabase Storage)
3. Run end-to-end smoke test (Task 7.8)
4. Setup monitoring and alerts (Task 7.9)

**Need help?** Check Railway logs first, then review troubleshooting section above.

