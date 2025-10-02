# 🏗️ ROBUST API Ingestion System - Complete Plan

**Goal:** Production-grade automated product ingestion with ALL data fields

---

## 📊 PHASE 1: DATABASE ENHANCEMENT

### **Current Schema Gaps:**
Your Product model is missing:
- ❌ Shipping cost
- ❌ Delivery time estimates
- ❌ Stock quantity / inventory status
- ❌ Original price (for discount calculation)
- ❌ Multiple images (only capturing 1st image)
- ❌ Product dimensions/weight
- ❌ Condition (new/used)
- ❌ Prime eligibility (Amazon)
- ❌ Seller information

### **What We'll Add:**

```prisma
model Product {
  // ... existing fields ...
  
  // Pricing & Discounts
  price           Float
  originalPrice   Float?        // List price before discount
  discountPercent Float?        // Calculated discount %
  
  // Shipping & Delivery
  shippingCost    Float?        // Shipping cost in currency
  freeShipping    Boolean       @default(false)
  deliveryDays    String?       // e.g., "2-3 days", "Oct 5-7"
  deliveryMin     Int?          // Minimum delivery days
  deliveryMax     Int?          // Maximum delivery days
  primeEligible   Boolean?      // Amazon Prime
  
  // Inventory
  inStock         Boolean       @default(true)
  stockQuantity   Int?          // If available
  availability    AvailabilityStatus
  
  // Product Details
  images          String[]      // Multiple images
  imagesThumbnail String[]      // Thumbnail versions
  description     String        @db.Text
  shortDescription String?      // Brief version
  features        String[]      // Bullet points
  
  // Physical Attributes
  weight          Float?        // in lbs or kg
  dimensions      String?       // e.g., "10x8x2 inches"
  
  // Quality & Trust
  condition       ProductCondition @default(NEW)
  rating          Float?
  numReviews      Int?
  bestSeller      Boolean       @default(false)
  
  // ... rest of existing fields ...
}

enum ProductCondition {
  NEW
  LIKE_NEW
  USED_VERY_GOOD
  USED_GOOD
  USED_ACCEPTABLE
  REFURBISHED
}
```

---

## 📡 PHASE 2: API CAPABILITIES AUDIT

### **Rainforest API (Amazon Data) - What We Get:**

**Search Results Endpoint:**
```json
{
  "search_results": [
    {
      "asin": "B08EXAMPLE",
      "title": "Product Name",
      "link": "https://amazon.com/...",
      "image": "https://m.media-amazon.com/...",
      "prices": [
        {
          "symbol": "$",
          "value": 29.99,
          "currency": "USD",
          "raw": "$29.99"
        }
      ],
      "rating": 4.5,
      "ratings_total": 1234,
      "is_prime": true,
      "categories": [{"name": "Electronics"}],
      
      // Additional fields we're NOT capturing yet:
      "price_upper": 34.99,        // Original price
      "unit_price": "$0.30/oz",    // Unit pricing
      "availability": {
        "raw": "In Stock",
        "type": "in_stock"
      },
      "delivery": {
        "free": true,
        "date": "Oct 5",
        "range": {
          "min": 2,
          "max": 3
        }
      }
    }
  ]
}
```

**Product Details Endpoint** (more detailed):
```json
{
  "product": {
    "asin": "B08EXAMPLE",
    "title": "Full Product Title",
    "description": "Long description...",
    "feature_bullets": ["Feature 1", "Feature 2"],
    "images": [
      {"link": "https://..."},
      {"link": "https://..."}
    ],
    "main_image": {"link": "https://..."},
    "variants": [...],
    "buybox_winner": {
      "price": {
        "value": 29.99,
        "currency": "USD"
      },
      "rrp": {
        "value": 39.99,
        "currency": "USD"
      },
      "shipping": {
        "raw": "FREE delivery"
      },
      "availability": {
        "type": "in_stock",
        "raw": "In Stock"
      }
    },
    "bestsellers_rank": [...],
    "rating": 4.5,
    "ratings_total": 1234,
    "specifications": [
      {"name": "Weight", "value": "1.2 pounds"}
    ]
  }
}
```

**API Costs:**
- $49/mo = 1000 requests
- Search = 1 credit, Product Details = 1 credit
- Strategy: Use Search for discovery, Product Details for enrichment

---

### **eBay Browse API - What We Get:**

**Search Endpoint:**
```json
{
  "itemSummaries": [
    {
      "itemId": "v1|123456789|0",
      "title": "Product Title",
      "price": {
        "value": "29.99",
        "currency": "USD"
      },
      "image": {
        "imageUrl": "https://i.ebayimg.com/..."
      },
      "itemWebUrl": "https://www.ebay.com/itm/...",
      "categories": [...],
      "condition": "New",
      "seller": {
        "username": "seller123",
        "feedbackPercentage": "99.2",
        "feedbackScore": 5000
      },
      "shippingOptions": [
        {
          "shippingCostType": "FIXED",
          "shippingCost": {
            "value": "0.00",
            "currency": "USD"
          },
          "type": "SHIPPING",
          "guaranteedDelivery": true,
          "minEstimatedDeliveryDate": "2024-10-05",
          "maxEstimatedDeliveryDate": "2024-10-07"
        }
      ],
      "availableQuantity": 10,
      "buyingOptions": ["FIXED_PRICE"]
    }
  ]
}
```

**Item Details Endpoint:**
```json
{
  "itemId": "v1|123456789|0",
  "title": "Product Title",
  "shortDescription": "Brief description",
  "description": "Full HTML description",
  "image": {...},
  "additionalImages": [
    {"imageUrl": "https://..."},
    {"imageUrl": "https://..."}
  ],
  "price": {...},
  "shippingOptions": [...],
  "availableQuantity": 10,
  "condition": "NEW",
  "conditionDescription": "Brand New",
  "itemLocation": {
    "city": "San Francisco",
    "stateOrProvince": "CA",
    "country": "US"
  }
}
```

**API Costs:**
- FREE (with approved app)
- Rate limit: 5000 calls/day

---

## 🏗️ PHASE 3: ENHANCED PROVIDER ARCHITECTURE

### **New File Structure:**
```
lib/providers/
├── base.ts                 # Base provider interface
├── rainforest/
│   ├── client.ts          # API client with retry/caching
│   ├── search.ts          # Search products
│   ├── details.ts         # Get detailed product info
│   ├── types.ts           # TypeScript types
│   └── mapper.ts          # Map API data to our schema
├── ebay/
│   ├── client.ts          # API client
│   ├── search.ts          # Search products
│   ├── details.ts         # Get item details
│   ├── types.ts           # TypeScript types
│   └── mapper.ts          # Map API data to our schema
└── ingestion/
    ├── orchestrator.ts    # Main ingestion coordinator
    ├── quality.ts         # Quality scoring
    ├── deduplication.ts   # Prevent duplicates
    └── logger.ts          # Structured logging
```

---

## 🎯 PHASE 4: ROBUST FEATURES

### **1. Error Handling & Resilience**
- ✅ Retry logic with exponential backoff
- ✅ Circuit breaker pattern
- ✅ Graceful degradation
- ✅ Rate limit handling
- ✅ API quota tracking

### **2. Data Quality**
- ✅ Enhanced quality scoring (0-1 scale)
  - Has images: 0.15
  - Has multiple images: 0.05
  - Has description: 0.10
  - Has reviews/rating: 0.10
  - Has shipping info: 0.10
  - Price reasonable: 0.10
  - Has delivery estimate: 0.10
  - Has stock status: 0.10
  - Has embedding: 0.20
- ✅ Auto-approve if score >= 0.80
- ✅ Flag for review if score < 0.60

### **3. Deduplication**
- ✅ Check by ASIN (Amazon)
- ✅ Check by itemId (eBay)
- ✅ Check by urlCanonical
- ✅ Check by title similarity (fuzzy match)
- ✅ Merge updates intelligently

### **4. Monitoring & Logging**
- ✅ Structured JSON logs
- ✅ Ingestion metrics (success/fail/skip)
- ✅ Performance tracking
- ✅ Daily summary reports
- ✅ Alert on high failure rate

### **5. Incremental Updates**
- ✅ Track lastSeenAt
- ✅ Update existing products
- ✅ Mark stale products (not seen in 30 days)
- ✅ Archive out-of-stock products

---

## 📅 IMPLEMENTATION TIMELINE

### **Day 1: Database & Core (6 hours)**
1. ✅ Create Prisma migration for new fields (1 hour)
2. ✅ Build base provider interface (1 hour)
3. ✅ Build quality scorer (1 hour)
4. ✅ Build deduplication logic (1 hour)
5. ✅ Build logging system (1 hour)
6. ✅ Test infrastructure (1 hour)

### **Day 2: Rainforest Provider (6 hours)**
1. ✅ Build Rainforest client with retry (1 hour)
2. ✅ Implement search endpoint (1 hour)
3. ✅ Implement product details endpoint (1 hour)
4. ✅ Build data mapper (2 hours)
5. ✅ Test with real API (1 hour)

### **Day 3: eBay Provider (6 hours)**
1. ✅ Build eBay client (1 hour)
2. ✅ Implement search endpoint (1 hour)
3. ✅ Implement item details endpoint (1 hour)
4. ✅ Build data mapper (2 hours)
5. ✅ Test with real API (1 hour)

### **Day 4: Orchestration & Testing (6 hours)**
1. ✅ Build ingestion orchestrator (2 hours)
2. ✅ Build keyword management (1 hour)
3. ✅ End-to-end testing (2 hours)
4. ✅ Performance optimization (1 hour)

### **Day 5: Automation & Deploy (4 hours)**
1. ✅ Build CLI commands (1 hour)
2. ✅ Set up cron jobs (1 hour)
3. ✅ Create monitoring dashboard (1 hour)
4. ✅ Deploy to production (1 hour)

**Total: 28 hours over 5 days**

---

## 💰 COST ESTIMATE

### **API Costs:**
- **Rainforest API:** $49/mo (1000 requests)
  - 500 search requests = 500 products
  - 200 detail requests = enrichment
  - Reserve 300 for daily updates

- **eBay API:** $0 (free with approved app)
  - 5000 requests/day = plenty for our needs

**Total: $49/month**

### **Infrastructure:**
- Vercel Pro: $20/mo (already have)
- Supabase: $0-25/mo (start free)
- OpenAI API: ~$10/mo (for embeddings)

**Grand Total: $79-104/month**

---

## 🎯 EXPECTED OUTCOMES

### **Week 1:**
- 1000+ products ingested
- 90%+ have complete data (price, images, shipping, delivery)
- 85%+ auto-approved
- Zero duplicates

### **Month 1:**
- 3000+ products
- 15+ categories covered
- Daily automated updates
- 95%+ data completeness

### **Quality Metrics:**
- Average quality score: > 0.85
- Products with images: 98%+
- Products with shipping info: 90%+
- Products with delivery estimates: 85%+
- Products in stock: 95%+

---

## 🚀 EXECUTION PLAN

### **What I'll Build for You:**

1. **Database Migration** (add all new fields)
2. **Enhanced Rainforest Provider** (capture ALL data)
3. **Enhanced eBay Provider** (capture ALL data)
4. **Quality Scoring System** (robust scoring)
5. **Deduplication Engine** (prevent duplicates)
6. **Ingestion Orchestrator** (coordinate everything)
7. **CLI Tools** (easy to run)
8. **Monitoring Dashboard** (track progress)
9. **Automated Cron Jobs** (daily updates)
10. **Documentation** (how to use everything)

### **API Keys You'll Need:**

```bash
# .env additions
RAINFOREST_API_KEY=your_rainforest_key
EBAY_APP_ID=your_ebay_app_id
EBAY_CERT_ID=your_ebay_cert_id
EBAY_DEV_ID=your_ebay_dev_id
EBAY_OAUTH_TOKEN=your_oauth_token
EBAY_CAMPAIGN_ID=your_campaign_id  # Optional, for affiliate
OPENAI_API_KEY=your_openai_key  # For embeddings
```

---

## 📊 INGESTION STRATEGY

### **Initial Seed (Week 1):**

**Gift Categories (50 products each):**
1. Tech Gadgets & Electronics
2. Personalized & Custom Gifts
3. Home & Kitchen
4. Jewelry & Accessories
5. Books & Media
6. Toys & Games
7. Beauty & Self-Care
8. Sports & Fitness
9. Food & Gourmet
10. Outdoor & Travel
11. Art & Crafts
12. Fashion & Apparel
13. Pet Gifts
14. Office & Stationery
15. Baby & Kids
16. Gifts for Her
17. Gifts for Him
18. Gifts for Teens
19. Gifts Under $25
20. Luxury Gifts

**Total: 1000 products in first run**

### **Ongoing Updates (Daily):**
- Refresh 100 existing products
- Add 50 new products
- Remove out-of-stock items
- Update prices/availability

---

## ✅ SUCCESS CRITERIA

**Before Launch:**
- [ ] 1000+ products in database
- [ ] 90%+ data completeness
- [ ] Average quality score > 0.80
- [ ] All gift categories covered
- [ ] Zero duplicate products
- [ ] Shipping info on 85%+ products
- [ ] Delivery estimates on 80%+ products
- [ ] Multiple images on 70%+ products

**Performance:**
- [ ] Ingestion rate: 50-100 products/hour
- [ ] API error rate: < 5%
- [ ] Quality rejection rate: < 20%
- [ ] Duplicate detection: 100% accuracy

---

## 🔧 MAINTENANCE PLAN

### **Daily (Automated):**
- Ingest 50 new products
- Update 100 random existing products
- Check for out-of-stock items
- Generate quality report

### **Weekly (Manual):**
- Review quality metrics
- Adjust keyword list
- Check for API issues
- Review flagged products

### **Monthly (Manual):**
- Analyze conversion rates by source
- Optimize keyword targeting
- Review and update categories
- Audit data quality

---

## 📞 NEXT STEPS

**I'm ready to build this NOW. Here's what happens:**

### **Step 1: You Get API Keys** (30 min)
1. Sign up for Rainforest API
2. Get eBay developer credentials

### **Step 2: I Build Everything** (3-4 days)
- Database migration
- Enhanced providers
- Orchestration system
- Testing & optimization

### **Step 3: Initial Ingestion** (4-6 hours)
- Run first ingestion
- Get 1000 products
- Verify quality

### **Step 4: Deploy & Automate** (2 hours)
- Deploy to production
- Set up cron jobs
- Monitor first 24 hours

**Total Timeline: 5-7 days to production-ready system**

---

## 💡 QUESTIONS FOR YOU

Before I start building:

1. **API Budget:** Confirmed $49/mo for Rainforest is OK?
2. **Data Priority:** Any specific fields MORE important? (delivery time vs price vs images?)
3. **Categories:** Should I add more than the 20 I listed?
4. **Geography:** Start with US only or multi-country?
5. **Timeline:** Want me to start building NOW?

**Tell me "GO" and I'll start with the database migration!** 🚀

