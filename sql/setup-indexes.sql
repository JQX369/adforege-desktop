-- This script sets up indexes for pgvector similarity search
-- Run this in Supabase SQL Editor after enabling pgvector

-- Create index for Product embeddings
CREATE INDEX IF NOT EXISTS product_embedding_idx ON "Product" 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for User embeddings  
CREATE INDEX IF NOT EXISTS user_embedding_idx ON "User" 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('Product', 'User') 
AND indexname LIKE '%embedding%'; 