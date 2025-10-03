-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for vector similarity search on Product embeddings
CREATE INDEX IF NOT EXISTS product_embedding_idx ON "Product" 
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);

-- Create index for User embeddings if needed
CREATE INDEX IF NOT EXISTS user_embedding_idx ON "User" 
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100); 