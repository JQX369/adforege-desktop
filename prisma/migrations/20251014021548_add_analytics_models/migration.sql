-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "properties" JSONB,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "page" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsMetric" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "uniqueSessions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnalyticsMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_event_idx" ON "AnalyticsEvent"("event");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_page_idx" ON "AnalyticsEvent"("page");

-- CreateIndex
CREATE INDEX "AnalyticsMetric_eventType_idx" ON "AnalyticsMetric"("eventType");

-- CreateIndex
CREATE INDEX "AnalyticsMetric_date_idx" ON "AnalyticsMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsMetric_eventType_date_key" ON "AnalyticsMetric"("eventType", "date");

-- CreateIndex
CREATE INDEX "ClickEvent_userId_idx" ON "ClickEvent"("userId");

-- CreateIndex
CREATE INDEX "ClickEvent_productId_idx" ON "ClickEvent"("productId");

-- CreateIndex
CREATE INDEX "ClickEvent_targetUrl_idx" ON "ClickEvent"("targetUrl");

-- CreateIndex
CREATE INDEX "ClickEvent_createdAt_idx" ON "ClickEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ClickEvent_sessionId_userId_idx" ON "ClickEvent"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "ClickEvent_sessionId_productId_idx" ON "ClickEvent"("sessionId", "productId");

-- CreateIndex
CREATE INDEX "ClickEvent_userId_productId_idx" ON "ClickEvent"("userId", "productId");

-- CreateIndex
CREATE INDEX "ClickEvent_sessionId_createdAt_idx" ON "ClickEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickEvent_userId_createdAt_idx" ON "ClickEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickEvent_productId_createdAt_idx" ON "ClickEvent"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickEvent_sessionId_userId_productId_idx" ON "ClickEvent"("sessionId", "userId", "productId");

-- CreateIndex
CREATE INDEX "ClickEvent_sessionId_userId_createdAt_idx" ON "ClickEvent"("sessionId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickEvent_userId_productId_createdAt_idx" ON "ClickEvent"("userId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJob_type_idx" ON "IngestionJob"("type");

-- CreateIndex
CREATE INDEX "IngestionJob_status_idx" ON "IngestionJob"("status");

-- CreateIndex
CREATE INDEX "IngestionJob_source_idx" ON "IngestionJob"("source");

-- CreateIndex
CREATE INDEX "IngestionJob_startedAt_idx" ON "IngestionJob"("startedAt");

-- CreateIndex
CREATE INDEX "IngestionJob_finishedAt_idx" ON "IngestionJob"("finishedAt");

-- CreateIndex
CREATE INDEX "IngestionJob_totalProcessed_idx" ON "IngestionJob"("totalProcessed");

-- CreateIndex
CREATE INDEX "IngestionJob_totalInserted_idx" ON "IngestionJob"("totalInserted");

-- CreateIndex
CREATE INDEX "IngestionJob_totalUpdated_idx" ON "IngestionJob"("totalUpdated");

-- CreateIndex
CREATE INDEX "IngestionJob_totalRejected_idx" ON "IngestionJob"("totalRejected");

-- CreateIndex
CREATE INDEX "IngestionJob_type_status_idx" ON "IngestionJob"("type", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_status_startedAt_idx" ON "IngestionJob"("status", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionJob_source_status_idx" ON "IngestionJob"("source", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_startedAt_finishedAt_idx" ON "IngestionJob"("startedAt", "finishedAt");

-- CreateIndex
CREATE INDEX "IngestionJob_type_status_source_idx" ON "IngestionJob"("type", "status", "source");

-- CreateIndex
CREATE INDEX "IngestionJob_status_startedAt_finishedAt_idx" ON "IngestionJob"("status", "startedAt", "finishedAt");

-- CreateIndex
CREATE INDEX "Merchant_name_idx" ON "Merchant"("name");

-- CreateIndex
CREATE INDEX "Merchant_domain_idx" ON "Merchant"("domain");

-- CreateIndex
CREATE INDEX "Merchant_affiliateProgram_idx" ON "Merchant"("affiliateProgram");

-- CreateIndex
CREATE INDEX "Merchant_status_idx" ON "Merchant"("status");

-- CreateIndex
CREATE INDEX "Merchant_createdAt_idx" ON "Merchant"("createdAt");

-- CreateIndex
CREATE INDEX "Merchant_updatedAt_idx" ON "Merchant"("updatedAt");

-- CreateIndex
CREATE INDEX "Merchant_status_affiliateProgram_idx" ON "Merchant"("status", "affiliateProgram");

-- CreateIndex
CREATE INDEX "Merchant_createdAt_status_idx" ON "Merchant"("createdAt", "status");

-- CreateIndex
CREATE INDEX "Merchant_domain_status_idx" ON "Merchant"("domain", "status");

-- CreateIndex
CREATE INDEX "Merchant_name_status_idx" ON "Merchant"("name", "status");

-- CreateIndex
CREATE INDEX "Merchant_affiliateProgram_status_createdAt_idx" ON "Merchant"("affiliateProgram", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_source_idx" ON "Product"("source");

-- CreateIndex
CREATE INDEX "Product_vendorId_idx" ON "Product"("vendorId");

-- CreateIndex
CREATE INDEX "Product_merchantId_idx" ON "Product"("merchantId");

-- CreateIndex
CREATE INDEX "Product_price_idx" ON "Product"("price");

-- CreateIndex
CREATE INDEX "Product_rating_idx" ON "Product"("rating");

-- CreateIndex
CREATE INDEX "Product_qualityScore_idx" ON "Product"("qualityScore");

-- CreateIndex
CREATE INDEX "Product_popularityScore_idx" ON "Product"("popularityScore");

-- CreateIndex
CREATE INDEX "Product_recencyScore_idx" ON "Product"("recencyScore");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "Product_updatedAt_idx" ON "Product"("updatedAt");

-- CreateIndex
CREATE INDEX "Product_lastSeenAt_idx" ON "Product"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Product_expiresAt_idx" ON "Product"("expiresAt");

-- CreateIndex
CREATE INDEX "Product_availability_idx" ON "Product"("availability");

-- CreateIndex
CREATE INDEX "Product_categories_idx" ON "Product"("categories");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_retailer_idx" ON "Product"("retailer");

-- CreateIndex
CREATE INDEX "Product_affiliateProgram_idx" ON "Product"("affiliateProgram");

-- CreateIndex
CREATE INDEX "Product_sellerName_idx" ON "Product"("sellerName");

-- CreateIndex
CREATE INDEX "Product_sellerRating_idx" ON "Product"("sellerRating");

-- CreateIndex
CREATE INDEX "Product_stockQuantity_idx" ON "Product"("stockQuantity");

-- CreateIndex
CREATE INDEX "Product_deliveryMin_idx" ON "Product"("deliveryMin");

-- CreateIndex
CREATE INDEX "Product_deliveryMax_idx" ON "Product"("deliveryMax");

-- CreateIndex
CREATE INDEX "Product_weight_idx" ON "Product"("weight");

-- CreateIndex
CREATE INDEX "Product_discountPercent_idx" ON "Product"("discountPercent");

-- CreateIndex
CREATE INDEX "Product_originalPrice_idx" ON "Product"("originalPrice");

-- CreateIndex
CREATE INDEX "Product_shippingCost_idx" ON "Product"("shippingCost");

-- CreateIndex
CREATE INDEX "Product_currency_idx" ON "Product"("currency");

-- CreateIndex
CREATE INDEX "Product_title_idx" ON "Product"("title");

-- CreateIndex
CREATE INDEX "Product_description_idx" ON "Product"("description");

-- CreateIndex
CREATE INDEX "Product_shortDescription_idx" ON "Product"("shortDescription");

-- CreateIndex
CREATE INDEX "Product_features_idx" ON "Product"("features");

-- CreateIndex
CREATE INDEX "Product_dimensions_idx" ON "Product"("dimensions");

-- CreateIndex
CREATE INDEX "Product_lastEnrichedAt_idx" ON "Product"("lastEnrichedAt");

-- CreateIndex
CREATE INDEX "Product_numReviews_idx" ON "Product"("numReviews");

-- CreateIndex
CREATE INDEX "Product_images_idx" ON "Product"("images");

-- CreateIndex
CREATE INDEX "Product_imagesThumbnail_idx" ON "Product"("imagesThumbnail");

-- CreateIndex
CREATE INDEX "Product_status_source_idx" ON "Product"("status", "source");

-- CreateIndex
CREATE INDEX "Product_status_availability_idx" ON "Product"("status", "availability");

-- CreateIndex
CREATE INDEX "Product_price_rating_idx" ON "Product"("price", "rating");

-- CreateIndex
CREATE INDEX "Product_qualityScore_popularityScore_idx" ON "Product"("qualityScore", "popularityScore");

-- CreateIndex
CREATE INDEX "Product_createdAt_updatedAt_idx" ON "Product"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Product_vendorId_status_idx" ON "Product"("vendorId", "status");

-- CreateIndex
CREATE INDEX "Product_merchantId_status_idx" ON "Product"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Product_categories_price_idx" ON "Product"("categories", "price");

-- CreateIndex
CREATE INDEX "Product_brand_rating_idx" ON "Product"("brand", "rating");

-- CreateIndex
CREATE INDEX "Product_retailer_availability_idx" ON "Product"("retailer", "availability");

-- CreateIndex
CREATE INDEX "Product_affiliateProgram_status_idx" ON "Product"("affiliateProgram", "status");

-- CreateIndex
CREATE INDEX "Product_sellerName_sellerRating_idx" ON "Product"("sellerName", "sellerRating");

-- CreateIndex
CREATE INDEX "Product_stockQuantity_availability_idx" ON "Product"("stockQuantity", "availability");

-- CreateIndex
CREATE INDEX "Product_deliveryMin_deliveryMax_idx" ON "Product"("deliveryMin", "deliveryMax");

-- CreateIndex
CREATE INDEX "Product_weight_shippingCost_idx" ON "Product"("weight", "shippingCost");

-- CreateIndex
CREATE INDEX "Product_discountPercent_originalPrice_idx" ON "Product"("discountPercent", "originalPrice");

-- CreateIndex
CREATE INDEX "Product_currency_price_idx" ON "Product"("currency", "price");

-- CreateIndex
CREATE INDEX "Product_title_description_idx" ON "Product"("title", "description");

-- CreateIndex
CREATE INDEX "Product_shortDescription_features_idx" ON "Product"("shortDescription", "features");

-- CreateIndex
CREATE INDEX "Product_dimensions_weight_idx" ON "Product"("dimensions", "weight");

-- CreateIndex
CREATE INDEX "Product_condition_availability_idx" ON "Product"("condition", "availability");

-- CreateIndex
CREATE INDEX "Product_sourceItemId_source_idx" ON "Product"("sourceItemId", "source");

-- CreateIndex
CREATE INDEX "Product_lastEnrichedAt_updatedAt_idx" ON "Product"("lastEnrichedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Product_numReviews_rating_idx" ON "Product"("numReviews", "rating");

-- CreateIndex
CREATE INDEX "Product_images_imagesThumbnail_idx" ON "Product"("images", "imagesThumbnail");

-- CreateIndex
CREATE INDEX "Product_urlCanonical_asin_idx" ON "Product"("urlCanonical", "asin");

-- CreateIndex
CREATE INDEX "Product_inStock_availability_idx" ON "Product"("inStock", "availability");

-- CreateIndex
CREATE INDEX "Product_primeEligible_freeShipping_idx" ON "Product"("primeEligible", "freeShipping");

-- CreateIndex
CREATE INDEX "Product_bestSeller_qualityScore_idx" ON "Product"("bestSeller", "qualityScore");

-- CreateIndex
CREATE INDEX "Product_status_source_availability_idx" ON "Product"("status", "source", "availability");

-- CreateIndex
CREATE INDEX "Product_price_rating_qualityScore_idx" ON "Product"("price", "rating", "qualityScore");

-- CreateIndex
CREATE INDEX "Product_qualityScore_popularityScore_recencyScore_idx" ON "Product"("qualityScore", "popularityScore", "recencyScore");

-- CreateIndex
CREATE INDEX "Product_createdAt_updatedAt_lastSeenAt_idx" ON "Product"("createdAt", "updatedAt", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Product_vendorId_status_source_idx" ON "Product"("vendorId", "status", "source");

-- CreateIndex
CREATE INDEX "Product_merchantId_status_availability_idx" ON "Product"("merchantId", "status", "availability");

-- CreateIndex
CREATE INDEX "Product_categories_price_rating_idx" ON "Product"("categories", "price", "rating");

-- CreateIndex
CREATE INDEX "Product_brand_rating_qualityScore_idx" ON "Product"("brand", "rating", "qualityScore");

-- CreateIndex
CREATE INDEX "Product_retailer_availability_inStock_idx" ON "Product"("retailer", "availability", "inStock");

-- CreateIndex
CREATE INDEX "Product_affiliateProgram_status_source_idx" ON "Product"("affiliateProgram", "status", "source");

-- CreateIndex
CREATE INDEX "Product_sellerName_sellerRating_qualityScore_idx" ON "Product"("sellerName", "sellerRating", "qualityScore");

-- CreateIndex
CREATE INDEX "Product_stockQuantity_availability_inStock_idx" ON "Product"("stockQuantity", "availability", "inStock");

-- CreateIndex
CREATE INDEX "Product_deliveryMin_deliveryMax_shippingCost_idx" ON "Product"("deliveryMin", "deliveryMax", "shippingCost");

-- CreateIndex
CREATE INDEX "Product_weight_shippingCost_freeShipping_idx" ON "Product"("weight", "shippingCost", "freeShipping");

-- CreateIndex
CREATE INDEX "Product_discountPercent_originalPrice_price_idx" ON "Product"("discountPercent", "originalPrice", "price");

-- CreateIndex
CREATE INDEX "Product_currency_price_shippingCost_idx" ON "Product"("currency", "price", "shippingCost");

-- CreateIndex
CREATE INDEX "Product_title_description_shortDescription_idx" ON "Product"("title", "description", "shortDescription");

-- CreateIndex
CREATE INDEX "Product_shortDescription_features_categories_idx" ON "Product"("shortDescription", "features", "categories");

-- CreateIndex
CREATE INDEX "Product_dimensions_weight_shippingCost_idx" ON "Product"("dimensions", "weight", "shippingCost");

-- CreateIndex
CREATE INDEX "Product_condition_availability_inStock_idx" ON "Product"("condition", "availability", "inStock");

-- CreateIndex
CREATE INDEX "Product_sourceItemId_source_status_idx" ON "Product"("sourceItemId", "source", "status");

-- CreateIndex
CREATE INDEX "Product_lastEnrichedAt_updatedAt_createdAt_idx" ON "Product"("lastEnrichedAt", "updatedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Product_numReviews_rating_qualityScore_idx" ON "Product"("numReviews", "rating", "qualityScore");

-- CreateIndex
CREATE INDEX "Product_images_imagesThumbnail_title_idx" ON "Product"("images", "imagesThumbnail", "title");

-- CreateIndex
CREATE INDEX "Product_urlCanonical_asin_source_idx" ON "Product"("urlCanonical", "asin", "source");

-- CreateIndex
CREATE INDEX "Product_inStock_availability_status_idx" ON "Product"("inStock", "availability", "status");

-- CreateIndex
CREATE INDEX "Product_primeEligible_freeShipping_shippingCost_idx" ON "Product"("primeEligible", "freeShipping", "shippingCost");

-- CreateIndex
CREATE INDEX "Product_bestSeller_qualityScore_popularityScore_idx" ON "Product"("bestSeller", "qualityScore", "popularityScore");

-- CreateIndex
CREATE INDEX "RecommendLog_userId_idx" ON "RecommendLog"("userId");

-- CreateIndex
CREATE INDEX "RecommendLog_resultsCount_idx" ON "RecommendLog"("resultsCount");

-- CreateIndex
CREATE INDEX "RecommendLog_createdAt_idx" ON "RecommendLog"("createdAt");

-- CreateIndex
CREATE INDEX "RecommendLog_sessionId_userId_idx" ON "RecommendLog"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "RecommendLog_sessionId_createdAt_idx" ON "RecommendLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendLog_userId_createdAt_idx" ON "RecommendLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendLog_resultsCount_createdAt_idx" ON "RecommendLog"("resultsCount", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendLog_sessionId_userId_createdAt_idx" ON "RecommendLog"("sessionId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionProfile_sessionId_idx" ON "SessionProfile"("sessionId");

-- CreateIndex
CREATE INDEX "SessionProfile_region_idx" ON "SessionProfile"("region");

-- CreateIndex
CREATE INDEX "SessionProfile_createdAt_idx" ON "SessionProfile"("createdAt");

-- CreateIndex
CREATE INDEX "SessionProfile_updatedAt_idx" ON "SessionProfile"("updatedAt");

-- CreateIndex
CREATE INDEX "SessionProfile_region_createdAt_idx" ON "SessionProfile"("region", "createdAt");

-- CreateIndex
CREATE INDEX "SessionProfile_sessionId_region_idx" ON "SessionProfile"("sessionId", "region");

-- CreateIndex
CREATE INDEX "SessionProfile_createdAt_updatedAt_idx" ON "SessionProfile"("createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Swipe_userId_idx" ON "Swipe"("userId");

-- CreateIndex
CREATE INDEX "Swipe_productId_idx" ON "Swipe"("productId");

-- CreateIndex
CREATE INDEX "Swipe_action_idx" ON "Swipe"("action");

-- CreateIndex
CREATE INDEX "Swipe_ts_idx" ON "Swipe"("ts");

-- CreateIndex
CREATE INDEX "Swipe_userId_action_idx" ON "Swipe"("userId", "action");

-- CreateIndex
CREATE INDEX "Swipe_productId_action_idx" ON "Swipe"("productId", "action");

-- CreateIndex
CREATE INDEX "Swipe_userId_productId_idx" ON "Swipe"("userId", "productId");

-- CreateIndex
CREATE INDEX "Swipe_ts_action_idx" ON "Swipe"("ts", "action");

-- CreateIndex
CREATE INDEX "Swipe_userId_ts_idx" ON "Swipe"("userId", "ts");

-- CreateIndex
CREATE INDEX "Swipe_productId_ts_idx" ON "Swipe"("productId", "ts");

-- CreateIndex
CREATE INDEX "Swipe_userId_productId_action_idx" ON "Swipe"("userId", "productId", "action");

-- CreateIndex
CREATE INDEX "Swipe_userId_action_ts_idx" ON "Swipe"("userId", "action", "ts");

-- CreateIndex
CREATE INDEX "Swipe_productId_action_ts_idx" ON "Swipe"("productId", "action", "ts");

-- CreateIndex
CREATE INDEX "Swipe_userId_productId_action_ts_idx" ON "Swipe"("userId", "productId", "action", "ts");

-- CreateIndex
CREATE INDEX "Vendor_userId_idx" ON "Vendor"("userId");

-- CreateIndex
CREATE INDEX "Vendor_email_idx" ON "Vendor"("email");

-- CreateIndex
CREATE INDEX "Vendor_stripeCustomerId_idx" ON "Vendor"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Vendor_stripeSubscriptionId_idx" ON "Vendor"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Vendor_plan_idx" ON "Vendor"("plan");

-- CreateIndex
CREATE INDEX "Vendor_subscriptionStatus_idx" ON "Vendor"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "Vendor_currentPeriodEnd_idx" ON "Vendor"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Vendor_createdAt_idx" ON "Vendor"("createdAt");

-- CreateIndex
CREATE INDEX "Vendor_plan_subscriptionStatus_idx" ON "Vendor"("plan", "subscriptionStatus");

-- CreateIndex
CREATE INDEX "Vendor_subscriptionStatus_currentPeriodEnd_idx" ON "Vendor"("subscriptionStatus", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Vendor_createdAt_plan_idx" ON "Vendor"("createdAt", "plan");

-- CreateIndex
CREATE INDEX "Vendor_plan_subscriptionStatus_currentPeriodEnd_idx" ON "Vendor"("plan", "subscriptionStatus", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "ingestion_logs_createdAt_idx" ON "ingestion_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ingestion_logs_durationMs_idx" ON "ingestion_logs"("durationMs");

-- CreateIndex
CREATE INDEX "ingestion_logs_productsCreated_idx" ON "ingestion_logs"("productsCreated");

-- CreateIndex
CREATE INDEX "ingestion_logs_productsUpdated_idx" ON "ingestion_logs"("productsUpdated");

-- CreateIndex
CREATE INDEX "ingestion_logs_errors_idx" ON "ingestion_logs"("errors");

-- CreateIndex
CREATE INDEX "ingestion_logs_createdAt_durationMs_idx" ON "ingestion_logs"("createdAt", "durationMs");

-- CreateIndex
CREATE INDEX "ingestion_logs_productsCreated_productsUpdated_idx" ON "ingestion_logs"("productsCreated", "productsUpdated");

-- CreateIndex
CREATE INDEX "ingestion_logs_errors_createdAt_idx" ON "ingestion_logs"("errors", "createdAt");

-- CreateIndex
CREATE INDEX "ingestion_logs_durationMs_productsCreated_idx" ON "ingestion_logs"("durationMs", "productsCreated");

-- CreateIndex
CREATE INDEX "ingestion_logs_productsUpdated_errors_idx" ON "ingestion_logs"("productsUpdated", "errors");

-- CreateIndex
CREATE INDEX "ingestion_logs_createdAt_productsCreated_idx" ON "ingestion_logs"("createdAt", "productsCreated");

-- CreateIndex
CREATE INDEX "ingestion_logs_durationMs_productsUpdated_idx" ON "ingestion_logs"("durationMs", "productsUpdated");

-- CreateIndex
CREATE INDEX "ingestion_logs_productsCreated_errors_idx" ON "ingestion_logs"("productsCreated", "errors");

-- CreateIndex
CREATE INDEX "ingestion_logs_createdAt_durationMs_productsCreated_idx" ON "ingestion_logs"("createdAt", "durationMs", "productsCreated");

-- CreateIndex
CREATE INDEX "ingestion_logs_productsCreated_productsUpdated_errors_idx" ON "ingestion_logs"("productsCreated", "productsUpdated", "errors");

-- CreateIndex
CREATE INDEX "ingestion_logs_durationMs_productsUpdated_errors_idx" ON "ingestion_logs"("durationMs", "productsUpdated", "errors");

-- CreateIndex
CREATE INDEX "ingestion_logs_createdAt_productsCreated_productsUpdated_idx" ON "ingestion_logs"("createdAt", "productsCreated", "productsUpdated");

-- CreateIndex
CREATE INDEX "ingestion_logs_createdAt_durationMs_productsCreated_product_idx" ON "ingestion_logs"("createdAt", "durationMs", "productsCreated", "productsUpdated");

-- CreateIndex
CREATE INDEX "ingestion_logs_productsCreated_productsUpdated_errors_creat_idx" ON "ingestion_logs"("productsCreated", "productsUpdated", "errors", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_idx" ON "recommendation_events"("sessionId");

-- CreateIndex
CREATE INDEX "recommendation_events_userId_idx" ON "recommendation_events"("userId");

-- CreateIndex
CREATE INDEX "recommendation_events_productId_idx" ON "recommendation_events"("productId");

-- CreateIndex
CREATE INDEX "recommendation_events_action_idx" ON "recommendation_events"("action");

-- CreateIndex
CREATE INDEX "recommendation_events_createdAt_idx" ON "recommendation_events"("createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_userId_idx" ON "recommendation_events"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_productId_idx" ON "recommendation_events"("sessionId", "productId");

-- CreateIndex
CREATE INDEX "recommendation_events_userId_productId_idx" ON "recommendation_events"("userId", "productId");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_action_idx" ON "recommendation_events"("sessionId", "action");

-- CreateIndex
CREATE INDEX "recommendation_events_userId_action_idx" ON "recommendation_events"("userId", "action");

-- CreateIndex
CREATE INDEX "recommendation_events_productId_action_idx" ON "recommendation_events"("productId", "action");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_createdAt_idx" ON "recommendation_events"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_userId_createdAt_idx" ON "recommendation_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_productId_createdAt_idx" ON "recommendation_events"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_action_createdAt_idx" ON "recommendation_events"("action", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_userId_productId_idx" ON "recommendation_events"("sessionId", "userId", "productId");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_userId_action_idx" ON "recommendation_events"("sessionId", "userId", "action");

-- CreateIndex
CREATE INDEX "recommendation_events_userId_productId_action_idx" ON "recommendation_events"("userId", "productId", "action");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_productId_action_idx" ON "recommendation_events"("sessionId", "productId", "action");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_userId_createdAt_idx" ON "recommendation_events"("sessionId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_userId_productId_createdAt_idx" ON "recommendation_events"("userId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_sessionId_productId_createdAt_idx" ON "recommendation_events"("sessionId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_action_createdAt_2_idx" ON "recommendation_events"("action", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_userId_productId_action_idx" ON "recommendation_events"("sessionId", "userId", "productId", "action");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_userId_productId_createdAt_idx" ON "recommendation_events"("sessionId", "userId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_userId_action_createdAt_idx" ON "recommendation_events"("sessionId", "userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_userId_productId_action_createdAt_idx" ON "recommendation_events"("userId", "productId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_events_sessionId_productId_action_createdAt_idx" ON "recommendation_events"("sessionId", "productId", "action", "createdAt");
