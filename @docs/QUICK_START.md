# ⚡ Quick Start - Get Products Fast

**🎯 Goal:** 500 products in database, $0 cost, 2 days

---

## 🚀 THE FASTEST FREE PATH

### **Today (Day 1):**

1. **Manual Curation - 200 products** (8-10 hours)
   ```bash
   # Copy template
   cp data/seed-products-template.csv data/my-products.csv
   
   # Open in Excel/Google Sheets
   # Visit: Amazon Best Sellers, Etsy Popular Gifts
   # Copy: title, price, image URL, product URL
   # Add 200 rows
   ```

2. **Import to Database**
   ```bash
   ts-node scripts/smart-seed-products.ts --method=csv --file=./data/my-products.csv
   ```

### **Tomorrow (Day 2):**

1. **Get eBay API Access** (30 min - FREE!)
   - Visit: https://developer.ebay.com
   - Register → Get App ID
   - Add to `.env`: `EBAY_APP_ID=your_app_id`

2. **Auto-Import 300+ Products** (2 hours)
   ```bash
   ts-node scripts/smart-seed-products.ts --method=ebay
   ```

3. **Verify**
   ```bash
   npx prisma studio
   # Check Product table - should see 500+ products
   ```

**✅ Result:** 500+ products, ready to launch

---

## 💰 COST COMPARISON

| Method | Cost | Time | Products |
|--------|------|------|----------|
| **Manual Only** | $0 | 15 hrs | 300-500 |
| **eBay API Only** | $0 | 3 hrs | 300-500 |
| **Manual + eBay** ⭐ | **$0** | **10 hrs** | **500-800** |
| Apify | $49/mo | 4 hrs | 1000+ |
| Rainforest API | $49/mo | 3 hrs | 500-1000 |

**Recommendation:** Manual + eBay = Best value

---

## 📋 CSV FORMAT

```csv
title,description,price,imageUrl,url,categories,brand,retailer,currency,asin,merchantDomain,affiliateProgram
"Smart Watch","Fitness tracker with heart rate monitor",59.99,https://...,https://...,Tech|Fitness,FitBrand,Amazon,USD,B08EXAMPLE,amazon.com,amazon
```

**Quick Fill Tips:**
- Title: Copy exact product name
- Price: Just number (24.99)
- Categories: Use | separator (Tech|Gadgets|Electronics)
- ImageUrl: Right-click image → Copy address

---

## 🎯 PRODUCT CATEGORIES (Cover These)

- [ ] Tech & Gadgets (50+)
- [ ] Personalized Items (50+)
- [ ] Home & Kitchen (50+)
- [ ] Jewelry (40+)
- [ ] Books (30+)
- [ ] Toys & Games (40+)
- [ ] Beauty & Wellness (40+)
- [ ] Sports & Outdoors (30+)
- [ ] Food & Drink (30+)

**Minimum:** 400 products across 8+ categories

---

## ✅ QUALITY CHECKLIST

Before you launch:
- [ ] 400+ products in database
- [ ] 80%+ marked as APPROVED
- [ ] 90%+ have images
- [ ] 8+ categories covered
- [ ] Prices between $10-200
- [ ] Mix of Amazon, Etsy, and others

---

## 🛠️ COMMANDS CHEAT SHEET

```bash
# Import CSV
ts-node scripts/smart-seed-products.ts --method=csv --file=./data/my-products.csv

# Import from eBay (free)
ts-node scripts/smart-seed-products.ts --method=ebay

# Import from eBay with custom keywords
ts-node scripts/smart-seed-products.ts --method=ebay --keywords="tech,jewelry,home"

# Import from Apify (requires token)
ts-node scripts/smart-seed-products.ts --method=apify --source=etsy

# Run everything
ts-node scripts/smart-seed-products.ts --method=all

# Check database
npx prisma studio
```

---

## 🚨 IF SOMETHING BREAKS

### "Can't find prisma"
```bash
npm install
npx prisma generate
```

### "OPENAI_API_KEY not found"
```bash
# Add to .env:
OPENAI_API_KEY=sk-proj-your-key-here
```

### "eBay API 401 error"
```bash
# Double-check .env:
EBAY_APP_ID=your_app_id
EBAY_OAUTH_TOKEN=your_oauth_token
```

### "No products returned"
Try different keywords or check the API credentials

---

## 🎯 TODAY'S TODO

**Morning (4 hours):**
- [ ] Copy CSV template
- [ ] Browse Amazon/Etsy
- [ ] Add 100 products to CSV
- [ ] Import first batch

**Afternoon (4 hours):**
- [ ] Add 100 more products
- [ ] Get eBay API access
- [ ] Configure .env
- [ ] Run eBay import

**Evening (2 hours):**
- [ ] Verify 500+ products
- [ ] Test recommendation flow
- [ ] Celebrate! 🎉

---

## 💡 PRO TIPS

1. **Start with 10:** Import 10 products first to test
2. **Use template:** Copy/paste is faster than typing
3. **Quality over quantity:** 300 good products > 1000 bad ones
4. **Test early:** Run recommendation after 50 products
5. **Mix sources:** Amazon + Etsy + others = better diversity

---

## 📞 WHAT TO DO RIGHT NOW

**Option 1: DIY (10-12 hours over 2 days)**
```bash
# Start here:
1. Open data/seed-products-template.csv
2. Add 200 products today
3. Import tomorrow
4. Add eBay API
```

**Option 2: Let Me Help (2-3 hours)**
Tell me:
- "Run the eBay import for me"
- "Generate 500 products automatically"
- "Help me debug [issue]"

---

## 🎉 SUCCESS = LAUNCH

Once you have 500+ products:
1. ✅ Deploy to Vercel
2. ✅ Test recommendation flow
3. ✅ Apply for affiliate programs
4. ✅ Launch! 🚀

---

**Ready to start? Just say:**
- "Let's do manual curation"
- "Set up eBay API for me"
- "Run the automated import"
- "I need help with [X]"

**You're 500 products away from launch!** 🌱

