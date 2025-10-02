# 🌱 Product Seeding Guide - Cost-Optimized Approach

**Goal:** Get 500-1000 quality gift products into your database as cheaply as possible

---

## 💰 COST COMPARISON

### **Option 1: 100% Manual (FREE)** ⭐ CHEAPEST
- **Cost:** $0/month
- **Time:** 15-20 hours
- **Quality:** ⭐⭐⭐⭐⭐ Excellent (you control everything)
- **Products:** 200-500 (depending on your effort)
- **Best for:** Bootstrapping, high quality catalog, zero budget

### **Option 2: eBay API Only (FREE)** ⭐ BEST VALUE
- **Cost:** $0/month (free tier)
- **Time:** 2-3 hours setup + automated
- **Quality:** ⭐⭐⭐⭐ Good (real product data)
- **Products:** 500-1000+ (automated)
- **Best for:** Scaling quickly without spending money
- **Note:** Requires eBay Partner Network approval (usually instant)

### **Option 3: Manual + eBay Hybrid (FREE)** ⭐ RECOMMENDED
- **Cost:** $0/month
- **Time:** 10 hours total
- **Quality:** ⭐⭐⭐⭐⭐ Excellent mix
- **Products:** 500-800
- **Best for:** Launch-ready catalog in 2 days, zero cost

### **Option 4: Apify ($49/mo)**
- **Cost:** $49/month (400 platform credits)
- **Time:** 4-6 hours setup + automated
- **Quality:** ⭐⭐⭐ Variable
- **Products:** 1000+ (multiple sources)
- **Best for:** Scaling after launch, diverse sources
- **⚠️ Warning:** Amazon scraping violates ToS

### **Option 5: Rainforest API ($49/mo)**
- **Cost:** $49/month (1000 calls)
- **Time:** 3-4 hours setup + automated
- **Quality:** ⭐⭐⭐⭐ Good (official Amazon data)
- **Products:** 500-1000
- **Best for:** Legal Amazon data, post-launch scaling

---

## 🎯 MY RECOMMENDATION: Start with Option 3 (FREE!)

### **Why This Works:**
1. **Day 1:** Manually curate 200 high-quality products (8-10 hours)
2. **Day 2:** Set up eBay API and auto-import 300 more (2 hours)
3. **Result:** 500 products, $0 cost, launch-ready

**Then later (Month 2):**
- Add Rainforest API if you need more Amazon products
- Add Apify if you want Etsy/specialty retailers
- Keep manually curating unique high-converting items

---

## 📋 STEP-BY-STEP IMPLEMENTATION

### **PHASE 1: Manual Curation (Day 1)** - 8-10 hours

#### **Step 1: Prepare Your Workspace**
1. Open the template: `data/seed-products-template.csv`
2. Use Excel, Google Sheets, or Numbers
3. Set up 2-3 browser tabs

#### **Step 2: Source Products** (Use These Exact Pages)

**Amazon Best Sellers - Gift Ideas:**
- https://www.amazon.com/giftfinder/homepage
- https://www.amazon.com/Best-Sellers/zgbs
- Categories: Electronics, Home, Toys, Beauty

**Etsy Popular Gifts:**
- https://www.etsy.com/featured/gifts
- https://www.etsy.com/c/jewelry/necklaces/personalized-necklaces
- https://www.etsy.com/c/home-and-living/home-decor

**Uncommon Goods:**
- https://www.uncommongoods.com/gifts/for-her
- https://www.uncommongoods.com/gifts/for-him
- https://www.uncommongoods.com/gifts/personalized

**Target Categories (25 products each = 200 total):**
1. ✅ Tech & Gadgets ($20-100)
2. ✅ Personalized Items ($25-60)
3. ✅ Home Decor ($15-80)
4. ✅ Jewelry & Accessories ($20-150)
5. ✅ Kitchen & Cooking ($20-70)
6. ✅ Books & Stationery ($10-40)
7. ✅ Toys & Games ($15-60)
8. ✅ Beauty & Self-Care ($20-80)

#### **Step 3: Fill Out CSV** (5 minutes per product)

For each product, copy:
```
Title: Copy exact product name
Description: Copy product description (or write 1-2 sentences)
Price: Just the number (24.99)
ImageUrl: Right-click image → Copy image address
URL: Product page URL
Categories: Type relevant tags separated by | (Tech|Gadgets|Electronics)
Brand: If visible, otherwise leave blank
Retailer: Amazon or Etsy or Uncommon Goods
Currency: USD
ASIN: For Amazon, it's in the URL (/dp/B08EXAMPLE)
MerchantDomain: amazon.com or etsy.com
AffiliateProgram: amazon or etsy
```

**⏱️ Time Estimate:**
- 5 minutes per product × 200 products = 16 hours
- But with practice: 2-3 minutes per product = 8-10 hours

#### **Step 4: Import Your CSV**

```bash
# Test with first 10 products
ts-node scripts/smart-seed-products.ts --method=csv --file=./data/seed-products.csv

# Check database
npx prisma studio
# Navigate to Product table, verify they're there

# If looks good, continue adding more!
```

**✅ End of Day 1:** 200 products in database

---

### **PHASE 2: eBay API (Day 2)** - 2-3 hours - **FREE!**

#### **Step 1: Get eBay API Access** (30 minutes)

1. Go to https://developer.ebay.com/
2. Click "Get Started" → "Register"
3. Create a developer account
4. Go to "My Account" → "Application Keys"
5. Create a new application
6. Get your credentials:
   - App ID (Client ID)
   - OAuth token

#### **Step 2: Configure Environment**

Add to your `.env`:
```bash
EBAY_APP_ID=YourAppId123
EBAY_CLIENT_ID=YourAppId123  # Same as above
EBAY_OAUTH_TOKEN=your_oauth_token_here

# Optional: For affiliate tracking
EBAY_CAMPAIGN_ID=your_campaign_id  # From eBay Partner Network
```

#### **Step 3: Apply for eBay Partner Network** (Optional, 10 minutes)

1. Go to https://epn.ebay.com/
2. Sign up (usually instant approval)
3. Get your campaign ID
4. Add to `.env` above

#### **Step 4: Run Auto-Import**

```bash
# Import products for specific keywords
ts-node scripts/smart-seed-products.ts --method=ebay --keywords="unique gifts,tech gadgets,personalized gifts,home decor,jewelry gifts"

# Or use built-in keywords (recommended)
ts-node scripts/smart-seed-products.ts --method=ebay
```

**What Happens:**
- Script searches eBay for each keyword
- Gets 20 products per keyword
- Generates embeddings
- Calculates quality scores
- Auto-approves high-quality products

**⏱️ Time:** 30-60 minutes for 300-400 products

**✅ End of Day 2:** 500-600 products total (200 manual + 300-400 eBay)

---

### **PHASE 3: Optional Scaling** (Week 2+)

#### **Option A: Keep Manual Curation**
- Add 50-100 products per week
- Focus on high-converting items
- **Cost:** $0

#### **Option B: Add Apify for Etsy** ($49/mo)
```bash
# Sign up at https://apify.com
# Get API token
# Add to .env:
APIFY_TOKEN=your_apify_token

# Run Etsy scraper
ts-node scripts/smart-seed-products.ts --method=apify --source=etsy
```

**⚠️ Caution:**
- Only scrape sites that allow it
- Read their `robots.txt` and Terms of Service
- Etsy is generally OK for personal use
- **DO NOT scrape Amazon** (use Rainforest API instead)

#### **Option C: Add Rainforest API** ($49/mo)
```bash
# Sign up at https://www.rainforestapi.com
# Get API key
# Add to .env:
RAINFOREST_API_KEY=your_key_here

# Your existing lib/providers/rainforest.ts will work
# Run via your existing sync endpoints or build new script
```

---

## 🚀 QUICK START (Choose Your Path)

### **Path A: "Zero Budget Sprint" (FREE, 2 days)**

Day 1:
```bash
# 1. Copy template
cp data/seed-products-template.csv data/my-products.csv

# 2. Open in Excel and add 200 products (8-10 hours)
# Use sources listed above

# 3. Import
ts-node scripts/smart-seed-products.ts --method=csv --file=./data/my-products.csv
```

Day 2:
```bash
# 1. Get eBay API access (30 min)

# 2. Configure .env

# 3. Run import
ts-node scripts/smart-seed-products.ts --method=ebay

# 4. Verify
npx prisma studio
# Check Product table - should have 500+ products
```

**Total Cost:** $0  
**Total Time:** 12 hours  
**Result:** 500+ products, launch-ready

---

### **Path B: "Automated Fast Track" ($49/mo, 1 day)**

```bash
# 1. Sign up for eBay API (free) + Apify OR Rainforest ($49)

# 2. Configure .env with both

# 3. Run full pipeline
ts-node scripts/smart-seed-products.ts --method=all

# 4. This will:
#    - Import any CSV if exists
#    - Run eBay import (free)
#    - Run Apify import (if token set)
#    - Takes 2-3 hours total
```

**Total Cost:** $49/month  
**Total Time:** 4-6 hours  
**Result:** 1000+ products

---

### **Path C: "Hybrid Best Value" (FREE, 3 days)**

Day 1: Manual curation (100 products - 5 hours)  
Day 2: eBay API setup + import (300 products - 2 hours)  
Day 3: Manual curation (100 more - 5 hours)

**Total Cost:** $0  
**Total Time:** 12 hours over 3 days  
**Result:** 500 high-quality products

---

## 📊 QUALITY EXPECTATIONS

### **Manual Curation:**
- Quality Score: 0.95-1.0
- Approval Rate: 100%
- Conversion Rate: High (you picked them)

### **eBay API:**
- Quality Score: 0.75-0.90
- Approval Rate: 80%
- Conversion Rate: Medium-High

### **Apify (Etsy):**
- Quality Score: 0.70-0.85
- Approval Rate: 70-80%
- Conversion Rate: Medium

### **Your Goal:**
- Minimum 500 products
- Average quality score > 0.75
- At least 80% approved

---

## 🎯 CATEGORY CHECKLIST

Make sure you cover these categories for diverse recommendations:

- [ ] **Tech & Gadgets** (50+ products)
  - Wireless chargers, smart home, headphones
  
- [ ] **Personalized Gifts** (50+ products)
  - Engraved items, custom portraits, monogrammed

- [ ] **Home & Kitchen** (50+ products)
  - Decor, kitchen gadgets, organizers

- [ ] **Jewelry & Accessories** (40+ products)
  - Necklaces, bracelets, watches, bags

- [ ] **Books & Media** (30+ products)
  - Bestsellers, journals, coffee table books

- [ ] **Toys & Games** (40+ products)
  - Board games, puzzles, STEM toys

- [ ] **Beauty & Wellness** (40+ products)
  - Skincare, spa kits, aromatherapy

- [ ] **Sports & Outdoors** (30+ products)
  - Fitness gear, water bottles, camping

- [ ] **Food & Drink** (30+ products)
  - Gourmet baskets, coffee sets, specialty items

- [ ] **Experiences** (20+ products) - Optional
  - Gift cards, classes, subscriptions

**Target: 400+ products minimum across 8-10 categories**

---

## ✅ VERIFICATION CHECKLIST

After importing, verify:

```bash
# Check total count
npx prisma studio

# Or via script:
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const total = await prisma.product.count();
  const approved = await prisma.product.count({ where: { status: 'APPROVED' } });
  const withImages = await prisma.product.count({ where: { images: { isEmpty: false } } });
  const withPrice = await prisma.product.count({ where: { price: { gt: 0 } } });
  
  console.log('📊 Product Statistics:');
  console.log('  Total:', total);
  console.log('  Approved:', approved, '(' + (approved/total*100).toFixed(1) + '%)');
  console.log('  With Images:', withImages);
  console.log('  With Valid Price:', withPrice);
  
  if (approved >= 400 && withImages/total > 0.9 && withPrice/total > 0.95) {
    console.log('\\n✅ READY TO LAUNCH!');
  } else {
    console.log('\\n⚠️  Needs more work');
  }
}
check();
"
```

**Launch Readiness Criteria:**
- ✅ 400+ approved products
- ✅ 90%+ have images
- ✅ 95%+ have valid prices
- ✅ 8+ categories covered
- ✅ Average quality score > 0.75

---

## 🚨 COMMON ISSUES & SOLUTIONS

### **"Not enough products returned from eBay"**
**Solution:** Try more specific keywords or increase items per query in the code

### **"Quality scores too low"**
**Solution:** Focus on products with good images, descriptions, and reasonable prices

### **"eBay API returns 401 Unauthorized"**
**Solution:** Check your OAuth token is valid and not expired

### **"Duplicate products being created"**
**Solution:** Script should deduplicate by URL/ASIN automatically. Check `urlCanonical` field.

### **"Embeddings failing"**
**Solution:** Check OPENAI_API_KEY is set and has credits

---

## 💡 PRO TIPS

1. **Start Small:** Import 10 products first, verify quality, then scale

2. **Mix Sources:** Don't rely on one source - diversity is key

3. **Focus on Gift-Appropriate Items:** Skip consumables, spare parts, bulk items

4. **Price Range:** Target $15-150 for most products (sweet spot for gifts)

5. **Images Matter:** Products with good images convert 3x better

6. **Test Recommendations:** After importing 50 products, test the gift form

7. **Iterate:** Import → Test → Adjust → Repeat

---

## 📞 NEXT STEPS

1. **Choose your path** (A, B, or C)
2. **Set aside time** (12 hours for free path)
3. **Run the script** (I've built it for you)
4. **Verify results** (use checklist above)
5. **Deploy & launch!** 🚀

**Need help?** Just ask me:
- "Show me how to run the eBay import"
- "Help me debug quality scores"
- "Create a script for [specific need]"

---

**You've got this!** The script is ready. Pick your path and let's get those products loaded! 🌱

