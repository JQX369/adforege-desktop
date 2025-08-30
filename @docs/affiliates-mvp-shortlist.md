# Affiliates MVP Shortlist

## Direct API integrations (recommended for MVP)
- Amazon Product Advertising API (PA-API 5.0)
  - Coverage: broad physical goods; strong gifting relevance
  - Data: title, images, price, availability, rating, buy URL
  - Notes: strict compliance; cache/price freshness rules; approval needed
- eBay Browse API + Affiliate Links API
  - Coverage: new/used, hard-to-find, collectibles
  - Data: listings with rich metadata; affiliate link generator
  - Notes: reliable, good for long-tail gifts
- Best Buy Products API
  - Coverage: electronics, gadgets
  - Data: product catalog with specs/pricing
  - Notes: U.S.-centric; strong for tech gifts
- Etsy API v3 (affiliate via Awin/Impact)
  - Coverage: handmade, personalized gifts
  - Data: listings, shop info
  - Notes: ensure ToS alignment for search use; affiliate via network
- Viator Partner API
  - Coverage: experiences, tours, activities
  - Data: products, pricing, availability
  - Notes: request access; ideal for “experiences” gift type
- GetYourGuide Partner API
  - Coverage: experiences
  - Data: tours/activities
  - Notes: access on approval; complements Viator

## Aggregator networks (API or datafeeds)
- CJ Affiliate (Product Catalog & Links APIs)
- Awin ProductServe (product feeds)
- Impact.com (Catalogs)
- Rakuten Advertising (product/reporting APIs)
- ShareASale (datafeeds + APIs)
- Skimlinks / Sovrn Commerce (auto-link monetization)

Benefits: broad merchant coverage via one integration; trade-offs: onboarding per advertiser, variable data quality.

## Apify-first targets (no public API or restricted)
- Groupon (local deals/experiences)
- Not On The High Street (curated gifts)
- Uncommon Goods (unique gift items)
- Wayfair gift ideas categories (home goods)
- Urban-themed gift guides from reputable retailers (category pages)

Notes: respect robots/ToS; prefer structured pages; schedule polite crawls; dedupe and normalize.

## Recommended MVP sets
- Set A (API-first breadth): Amazon, eBay, Etsy, Best Buy, Viator
  - Why: covers physical + handmade + tech + experiences with stable APIs
- Set B (Network-first breadth): Awin ProductServe, CJ Catalog, Impact Catalogs
  - Why: fastest merchant coverage via one-to-few integrations; add Etsy/Viator if approved
- Set C (Apify boost): Groupon + 2 curated gift sites for gap-fill
  - Why: fill long-tail and geo-specific experiences while API approvals complete

## Next steps
1) Apply for API access (Amazon, eBay, Viator/GetYourGuide, Best Buy, Etsy app)
2) Join networks (CJ, Awin, Impact, Rakuten, ShareASale) and enable 3–5 anchor merchants
3) Stand up ingestion: normalize to gift schema; add affiliate deep links
4) If Apify path used: implement Actors, schedules, and validation
5) A/B test conversions and zero-result reduction per source

