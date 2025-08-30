# AI Gift Finder - Setup Guide

## ✅ What's Already Done

1. **Project Structure**: All code is complete and ready
2. **Database Schema**: Tables created in your Supabase database
3. **Environment Variables**: Most credentials are configured

## 🔴 What You Still Need

### 1. **OpenAI API Key**
- Go to: https://platform.openai.com/api-keys
- Create a new API key
- Add to `.env` and `.env.local`:
  ```
  OPENAI_API_KEY="your-openai-api-key-here"
  ```

### 2. **Supabase Service Role Key**
- Go to your Supabase dashboard: https://supabase.com/dashboard/project/pjuvkxsofzmjcdatnbur
- Navigate to: Settings → API
- Copy the "service_role" key (not the anon key)
- Add to `.env` and `.env.local`:
  ```
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
  ```

### 3. **Enable pgvector in Supabase**
- Go to: https://supabase.com/dashboard/project/pjuvkxsofzmjcdatnbur/sql/new
- Run this SQL command:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

### 4. **Create Vector Indexes** (Optional but recommended)
- In the same SQL editor, run:
  ```sql
  -- Create index for Product embeddings
  CREATE INDEX IF NOT EXISTS product_embedding_idx ON "Product" 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

  -- Create index for User embeddings
  CREATE INDEX IF NOT EXISTS user_embedding_idx ON "User" 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
  ```

## 🚀 Running the App

Once you've added the missing API keys:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   - Main app: http://localhost:3000
   - Vendor submission: http://localhost:3000/vendor

## 🧪 Testing the App

1. **Test Gift Recommendations:**
   - Fill out the 12-question form
   - You'll get recommendations (currently as placeholders since no products are in the database)

2. **Test Vendor Submission:**
   - Go to /vendor
   - Fill out product details
   - Click "Proceed to Payment" (demo mode)
   - Product will be saved to database

3. **Add Some Test Products:**
   - Use the vendor form to add 5-10 products
   - Make sure to include variety in categories and prices
   - Products need status changed from PENDING to APPROVED to show in recommendations

## 📝 Quick SQL to Approve Products

After adding products via vendor form, run this in Supabase SQL editor to approve them:

```sql
UPDATE "Product" 
SET status = 'APPROVED' 
WHERE status = 'PENDING';
```

## 🌐 Deployment to Vercel

When ready to deploy:

1. Push to GitHub
2. Import to Vercel: https://vercel.com/new
3. Add all environment variables in Vercel dashboard
4. Deploy!

## 💡 Current Credentials Summary

✅ **Already configured:**
- Supabase Database URL
- Stripe keys (live)
- Amazon affiliate tag

❌ **Still needed:**
- OpenAI API key
- Supabase service role key

## 🆘 Troubleshooting

If you get errors:

1. **"Failed to get recommendations"**: Check OpenAI API key
2. **"Database connection failed"**: Check Supabase is running
3. **"Embedding error"**: Make sure pgvector is enabled
4. **No products showing**: Make sure products are APPROVED status 