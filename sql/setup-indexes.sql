-- This script sets up indexes for pgvector similarity search
-- Run this in Supabase SQL Editor after enabling pgvector

-- Create index for Product embeddings
-- (if vector column still exists; otherwise skip)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS product_embedding_idx ON "Product"
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for SessionProfile embeddings
CREATE INDEX CONCURRENTLY IF NOT EXISTS session_profile_embedding_idx ON "SessionProfile"
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Create composite index for fast recommendation event lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS recommendation_event_product_action_idx
ON "RecommendationEvent" ("productId", action, "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS recommendation_event_session_idx
ON "RecommendationEvent" ("sessionId", "createdAt");

-- Optional: prune legacy indexes if Product.embedding column removed
-- DROP INDEX IF EXISTS product_embedding_idx;