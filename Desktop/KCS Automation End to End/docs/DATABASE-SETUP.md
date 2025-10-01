# Database Setup Guide

## Prerequisites
- Supabase account (or Vercel Postgres, Neon, etc.)
- `pnpm` installed locally
- Project `.env` file with `DATABASE_URL`

## Step 1: Provision Database

### Option A: Supabase (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create new project or select existing
3. Navigate to **Settings** → **Database**
4. Copy the **Connection string (Session pooler)**
   - Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
5. Add to your `.env`:
   ```bash
   DATABASE_URL=postgresql://postgres.[project-ref]:[password]@...
   ```

### Option B: Vercel Postgres

1. Go to Vercel Dashboard → Storage → Create Database → Postgres
2. Copy `POSTGRES_PRISMA_URL` from environment variables
3. Add to `.env` as `DATABASE_URL`

### Option C: Neon

1. Go to [Neon Console](https://console.neon.tech)
2. Create new project
3. Copy connection string from dashboard
4. Add to `.env` as `DATABASE_URL`

---

## Step 2: Run Migrations

From project root:

```bash
# Navigate to project root
cd "C:\Users\Jacques Y\Desktop\KCS Automation End to End"

# Generate Prisma Client
pnpm --filter @kcs/db exec prisma generate

# Run all migrations
pnpm --filter @kcs/db exec prisma migrate deploy

# Verify migrations
pnpm --filter @kcs/db exec prisma migrate status
```

Expected output:
```
✔ All migrations have been applied
```

---

## Step 3: Seed Default Data

```bash
# Seed print configurations (4 reading age defaults)
pnpm --filter @kcs/db exec tsx prisma/seed-print-config.ts
```

Expected output:
```
Seeding print configurations...
  ✓ Created default print config for 3-4
  ✓ Created default print config for 4-6
  ✓ Created default print config for 6-7
  ✓ Created default print config for 8
Print configuration seeding complete!
```

---

## Step 4: Verify Schema

```bash
# Connect via Prisma Studio (GUI)
pnpm --filter @kcs/db exec prisma studio
```

Or query directly:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify PrintConfig records
SELECT id, name, "readingAge", "isDefault" FROM "PrintConfig";

-- Expected: 4 rows (3-4, 4-6, 6-7, 8)
```

---

## Step 5: Configure Vercel Environment

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following (one at a time):

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `DATABASE_URL` | (Your connection string) | Production, Preview, Development |
| `REDIS_HOST` | (Your Redis host) | Production, Preview, Development |
| `REDIS_PORT` | `6379` | Production, Preview, Development |
| `REDIS_PASSWORD` | (Your Redis password) | Production, Preview, Development |
| `REDIS_TLS` | `true` | Production, Preview, Development |
| `GEMINI_API_KEY` | (Your Gemini key) | Production, Preview, Development |
| `OPENAI_API_KEY` | (Your OpenAI key) | Production, Preview, Development |
| `JWT_SECRET` | (Generate: `openssl rand -base64 32`) | Production, Preview, Development |
| `ADMIN_API_TOKEN` | (Generate: `openssl rand -hex 32`) | Production, Preview, Development |

---

## Troubleshooting

### Error: "Can't reach database server"
- **Check**: Connection string format
- **Fix**: Ensure IP allowlist includes `0.0.0.0/0` (Supabase) or Vercel IPs

### Error: "relation does not exist"
- **Check**: Migrations ran successfully
- **Fix**: Run `prisma migrate deploy` again

### Error: "SSL connection required"
- **Check**: Connection string includes `?sslmode=require` or `?ssl=true`
- **Fix**: Add SSL param to DATABASE_URL

### Error: "Too many connections"
- **Check**: Using pooler connection string (Supabase)
- **Fix**: Use Session pooler URL, not Direct connection URL

---

## Migration History

All migrations are in `packages/db/prisma/migrations/`:
- Initial schema (Partner, Product, Order, Story, etc.)
- Phase 6 additions (PrintConfig, print pipeline fields)

To view migration SQL:
```bash
cat packages/db/prisma/migrations/*/migration.sql
```

---

## Production Checklist

- [ ] Database provisioned (Supabase/Vercel/Neon)
- [ ] `DATABASE_URL` added to local `.env`
- [ ] Migrations applied (`prisma migrate deploy`)
- [ ] Default data seeded (`seed-print-config.ts`)
- [ ] Schema verified (4 PrintConfig records exist)
- [ ] Vercel environment variables configured
- [ ] Test connection from local dev (`pnpm dev`)

---

## Next Steps

After database setup:
1. Deploy dashboard to Vercel (Task 7.4)
2. Setup worker service on Railway (Task 7.5)
3. Configure object storage (Task 7.6)

