# 🚀 The Gift Aunty - Fastest Route to Market

**Goal:** Launch in 7 days with minimum viable product catalog

---

## 🎯 THE PROBLEM

**You have a Ferrari with no gas.**

- ✅ Beautiful UI/UX
- ✅ AI recommendation engine
- ✅ Vendor subscription system
- ✅ Affiliate monetization ready
- ❌ **~0 products in database**

**Without products, nothing works.**

---

## ⚡ THE SOLUTION: 3-DAY SPRINT

### **Day 1: Manual Product Seeding (10-12 hours)**

**Goal:** 200 curated products in database

#### **Product Categories to Cover:**
1. **Tech & Gadgets (30 products)**
   - Wireless earbuds, smart home devices, phone accessories
   - Price range: $15-150
   
2. **Personalized Gifts (30 products)**
   - Custom jewelry, photo gifts, engraved items
   - Price range: $20-100

3. **Home & Kitchen (30 products)**
   - Unique decor, kitchen gadgets, cozy items
   - Price range: $15-80

4. **Books & Media (20 products)**
   - Bestsellers, coffee table books, journals
   - Price range: $10-40

5. **Fashion & Accessories (20 products)**
   - Scarves, watches, bags, jewelry
   - Price range: $25-150

6. **Toys & Games (20 products)**
   - Board games, puzzles, STEM toys
   - Price range: $15-60

7. **Beauty & Wellness (20 products)**
   - Skincare sets, aromatherapy, spa items
   - Price range: $20-80

8. **Outdoor & Sports (15 products)**
   - Fitness gear, camping accessories, water bottles
   - Price range: $15-100

9. **Food & Drink (15 products)**
   - Gourmet baskets, coffee/tea sets, specialty items
   - Price range: $25-80

#### **Sources (Use Mix):**
- Amazon Best Sellers in Gift Ideas
- Etsy "Popular Gifts" section
- Uncommon Goods homepage
- Not On The High Street trending

#### **CSV Format:**
```csv
title,description,price,imageUrl,url,categories,brand,retailer,currency,asin,merchantDomain,affiliateProgram
"Personalized Leather Keychain","Handcrafted leather keychain with custom engraving",24.99,https://...,https://...,Personalized|Accessories,CustomCo,etsy,USD,,etsy.com,etsy
```

#### **Process:**
1. Open Excel/Google Sheets
2. Visit source websites
3. Copy: title, description, price, image URL, product URL
4. Add categories (pipe-separated: `Tech|Gadgets|Electronics`)
5. Save as `seed-products.csv`

#### **Ingest:**
```bash
ts-node scripts/ingest-curated.ts ./data/seed-products.csv http://localhost:3000
```

**End of Day 1:** 200 products, app is functional ✅

---

### **Day 2: API Setup + Deploy (6-8 hours)**

#### **Morning: Affiliate Applications (2 hours)**

1. **Amazon Associates**
   - Go to: https://affiliate-program.amazon.com
   - Sign up, describe your site as "AI gift recommendation platform"
   - Get your tag: `yourtag-20`
   - Add to `.env`: `NEXT_PUBLIC_AMZ_TAG=yourtag-20`

2. **eBay Partner Network**
   - Go to: https://epn.ebay.com
   - Sign up (usually instant approval)
   - Get campaign ID
   - Add to `.env`: `EBAY_CAMPAIGN_ID=your_campaign_id`

3. **Etsy (via Awin or Impact)**
   - Apply at: https://www.awin.com or https://impact.com
   - Request Etsy program
   - Get your affiliate ID
   - Add to `.env`: `NEXT_PUBLIC_ETSY_ID=your_etsy_id`

#### **Afternoon: Production Deploy (4 hours)**

1. **Environment Variables:**
```bash
# Copy all from .env.local to Vercel dashboard
CRON_SECRET=$(openssl rand -base64 32)  # Generate secure random string
```

2. **Deploy:**
```bash
# Test build locally first
npm run build

# Deploy to Vercel
vercel --prod

# Run migrations on production database
npx prisma migrate deploy
```

3. **Verify Deployment:**
- [ ] Visit https://yourdomain.com
- [ ] Fill out gift form
- [ ] Verify 30 recommendations appear
- [ ] Click a product → verify redirect works
- [ ] Check `/vendor` page loads
- [ ] Try vendor signup flow

4. **Set up Custom Domain (if needed)**
   - Add domain in Vercel dashboard
   - Update DNS records

**End of Day 2:** Live production site ✅

---

### **Day 3: API Integration + Scale (8 hours)**

#### **Option A: Rainforest API (Recommended)**

**Why:** No Amazon approval needed, clean data, $49/mo

1. **Sign up:**
   - Go to: https://www.rainforestapi.com
   - Get API key
   - Add to `.env`: `RAINFOREST_API_KEY=your_key`

2. **Create ingestion script:**
```typescript
// scripts/seed-from-apis.ts
import { syncRainforestByKeyword } from '@/lib/providers/rainforest'
import { syncEbayByKeyword } from '@/lib/providers/ebay'

const KEYWORDS = [
  'unique gifts', 'personalized gifts', 'tech gadgets',
  'home decor gifts', 'jewelry gifts', 'gifts for mom',
  'gifts for dad', 'gifts for teens', 'luxury gifts',
  'budget gifts', 'handmade gifts', 'kitchen gifts',
]

async function main() {
  console.log('Starting ingestion...')
  
  for (const keyword of KEYWORDS) {
    console.log(`\nProcessing: ${keyword}`)
    
    try {
      // Amazon via Rainforest
      const rainforestResult = await syncRainforestByKeyword(keyword, 'US')
      console.log(`  Rainforest: +${rainforestResult.created} created, ${rainforestResult.updated} updated`)
      
      // eBay
      if (process.env.EBAY_APP_ID) {
        const ebayResult = await syncEbayByKeyword(keyword)
        console.log(`  eBay: +${ebayResult.created} created, ${ebayResult.updated} updated`)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`  Error for "${keyword}":`, error)
    }
  }
  
  console.log('\nIngestion complete!')
}

main()
```

3. **Run:**
```bash
ts-node scripts/seed-from-apis.ts
```

**Result:** 500-800 additional products ✅

#### **Option B: Manual Curation Part 2**
If you don't want to pay for APIs yet:
- Continue manual CSV process
- Target: 500 total products
- Focus on high-quality, gift-appropriate items

**End of Day 3:** 500-1000 products in catalog ✅

---

## 📅 DAY 4-7: POLISH & LAUNCH

### **Day 4: Testing & QA**

#### **Test All User Flows:**
1. **Gift Finder Flow (10 tests)**
   - [ ] Different age groups
   - [ ] Different interests
   - [ ] Different budgets
   - [ ] Different occasions
   - Verify: Recommendations are relevant

2. **Swipe Interface (5 tests)**
   - [ ] Swipe left (reject)
   - [ ] Swipe right (like)
   - [ ] Save (up swipe)
   - [ ] Load more products
   - Verify: Tracking works

3. **Vendor Flow (3 tests)**
   - [ ] Sign up
   - [ ] Choose subscription
   - [ ] Submit product
   - [ ] View dashboard
   - Verify: Stripe checkout works

4. **Affiliate Links (Critical)**
   - [ ] Amazon links have your tag
   - [ ] Etsy links have your ref
   - [ ] eBay links have campaign ID
   - [ ] Click tracking works

#### **Analytics Setup:**
```bash
# Add Plausible (easiest)
# In app/layout.tsx:
<script defer data-domain="thegiftaunty.com" 
  src="https://plausible.io/js/script.js"></script>

# Or Google Analytics
<Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX" />
```

### **Day 5: SEO & Content**

1. **Update metadata** (app/layout.tsx)
2. **Add sitemap.xml**
3. **Add robots.txt**
4. **Create OG images**
5. **Write 3-5 blog posts** (optional but valuable):
   - "10 Unique Gifts for [demographic]"
   - "How to Choose the Perfect Gift"
   - "Gift Ideas Under $50"

### **Day 6: Marketing Prep**

1. **Product Hunt Launch**
   - Create teaser page
   - Prepare screenshots
   - Write compelling description
   - Build launch day plan

2. **Reddit Strategy**
   - Identify subreddits: r/gifts, r/GiftIdeas, r/secretsanta
   - Prepare authentic, helpful posts
   - Don't spam - provide value

3. **Social Media**
   - Create accounts (Twitter, Instagram)
   - Design 10 posts
   - Schedule first week

4. **Email Capture**
   - Add simple email form to homepage
   - Set up Mailchimp/ConvertKit
   - Create welcome email

### **Day 7: LAUNCH**

#### **Morning:**
- [ ] Final smoke tests
- [ ] Post to Product Hunt (8am PST)
- [ ] Share on Twitter
- [ ] Post to relevant subreddits
- [ ] Email friends/family

#### **Afternoon:**
- [ ] Monitor analytics
- [ ] Respond to feedback
- [ ] Fix any critical bugs
- [ ] Engage with Product Hunt comments

#### **Evening:**
- [ ] Review metrics
- [ ] Plan next week's improvements

---

## 💰 COST BREAKDOWN

### **Minimum (Manual Route):**
- Domain: $12/year
- Vercel: $0 (hobby) or $20/mo (pro)
- Supabase: $0 (free tier)
- **Total: $20/mo**

### **Recommended (API Route):**
- Rainforest API: $49/mo
- Vercel Pro: $20/mo
- Supabase Pro: $25/mo (if needed)
- Plausible Analytics: $9/mo
- **Total: $103/mo**

### **ROI Calculation:**
- 1000 visitors/mo
- 5% complete gift form = 50 users
- 10% click through to product = 5 clicks
- 3% conversion = 0.15 sales
- $10 avg commission = $1.50/mo

**Not profitable yet - BUT:**
- Add 1 vendor subscriber at $39/mo = **Profitable**
- Or reach 10,000 visitors = $15 affiliate + likely 2-3 vendors = **$100-150/mo profit**

---

## 🎯 SUCCESS METRICS

### **Week 1:**
- [ ] 500+ products in database
- [ ] 100 gift form completions
- [ ] 10 product clicks
- [ ] 1 vendor signup

### **Week 4:**
- [ ] 1000+ products
- [ ] 1000 unique visitors
- [ ] 50 product clicks
- [ ] 5 vendor signups ($45-200 MRR)
- [ ] $10-50 affiliate revenue

---

## 🚨 RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| Empty catalog kills UX | CRITICAL | Manual curation Day 1 |
| Affiliate approval delays | HIGH | Use Rainforest API parallel |
| No traffic after launch | HIGH | Prep marketing channels now |
| Poor recommendation quality | MEDIUM | Test with diverse products |
| Vendor acquisition | LOW | Focus on users first |

---

## 🤝 WHAT I'LL BUILD FOR YOU

Choose what you need most:

### **Option 1: Product Seed Generator**
I'll create a script that:
- Scrapes top gift sites safely
- Formats into your CSV structure
- Validates data quality
- Generates 500 products automatically

### **Option 2: Enhanced API Ingestion**
I'll build:
- Automated keyword expansion
- Better product filtering
- Quality scoring improvements
- Nightly refresh optimization

### **Option 3: Launch Automation**
I'll create:
- Deployment verification script
- Smoke test suite
- Analytics dashboard
- Marketing automation

### **Option 4: All of the Above**
Full-stack sprint to get you launched in 3 days.

---

## 📞 IMMEDIATE NEXT STEP

**Tell me which path you want to take:**

**Path A: Manual Sprint** (Free, 3 days, full control)
- I'll give you the exact CSV template
- Help you source 200 products
- Guide deployment

**Path B: Automated + APIs** ($100-200 setup, 2 days, scalable)
- I'll build ingestion automation
- Set up Rainforest + eBay
- Deploy for you

**Path C: Hybrid** (Best of both, 3 days)
- Manual 200 products (Day 1)
- I build automation (Day 2-3)
- You review & launch (Day 3)

**Which path do you want to take?**

