# AI Gift Finder

A production-ready AI-powered gift recommendation web application that helps users find the perfect gift through an interactive questionnaire and Tinder-style swipe interface.

## Features

- 🎁 **12-Question Smart Form**: Comprehensive questionnaire to understand gift recipient preferences
- 🤖 **AI-Powered Recommendations**: Uses OpenAI GPT-4 to generate personalized gift suggestions
- 👆 **Tinder-Style Swipe Interface**: Intuitive swipe interactions (left/right/save)
- 🧠 **Machine Learning**: User preference vectors that improve recommendations over time
- 💰 **Vendor Submission System**: $9 Stripe integration for vendors to submit products
- 🔗 **Affiliate Links**: Automatic Amazon and Etsy affiliate tag appending
- 📊 **Vector Search**: Supabase with pgvector for semantic product matching

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (Edge Functions), Prisma ORM
- **Database**: Supabase PostgreSQL with pgvector extension
- **AI**: OpenAI GPT-4 & Embeddings API
- **Payments**: Stripe Checkout
- **UI Components**: react-tinder-card, shadcn/ui components
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account
- OpenAI API key
- Stripe account
- Amazon Associates & Etsy Affiliate accounts (optional)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-gift-finder.git
cd ai-gift-finder
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

Then edit `.env.local` with your credentials:
```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=your_postgres_connection_string

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Affiliate Programs (optional)
NEXT_PUBLIC_AMZ_TAG=your_amazon_affiliate_tag
NEXT_PUBLIC_ETSY_ID=your_etsy_affiliate_id
```

4. Set up Supabase database:

First, enable pgvector extension in Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then run Prisma migrations:
```bash
npx prisma generate
npx prisma migrate dev
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── recommend/          # Gift recommendation endpoint
│   │   ├── categorise-product/ # Product categorization
│   │   └── swipe/             # Swipe tracking & user vectors
│   ├── vendor/                # Vendor submission page
│   └── page.tsx              # Main app page
├── components/
│   ├── GiftForm.tsx          # 12-question wizard form
│   ├── SwipeDeck.tsx         # Tinder-style swipe interface
│   ├── ProductCard.tsx       # Product display card
│   └── SavedDrawer.tsx       # Saved products drawer
├── lib/
│   └── affiliates.ts         # Affiliate URL builder
├── prompts/
│   ├── GiftPrompt.ts         # Gift recommendation prompt
│   └── CategoriserPrompt.ts  # Product categorization prompt
└── prisma/
    └── schema.prisma         # Database schema
```

## Database Schema

The app uses three main models:

- **User**: Stores user preferences and embedding vectors
- **Product**: Product catalog with embeddings for semantic search
- **Swipe**: Tracks user interactions (LEFT/RIGHT/SAVED)

## API Endpoints

### POST /api/recommend
Generates gift recommendations based on form data.

### POST /api/categorise-product
Categorizes and adds vendor products to the database.

### POST /api/swipe
Records user swipes and updates preference vectors.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub

2. Import project to Vercel:
```bash
vercel
```

3. Configure environment variables in Vercel dashboard

4. Deploy:
```bash
vercel --prod
```

### Database Setup

1. In Supabase, ensure pgvector is enabled
2. Run migrations in production:
```bash
npx prisma migrate deploy
```

## Development Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Lint code
npm run lint

# Run Prisma Studio
npx prisma studio

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name
```

## Testing

To test the application:

1. **Gift Form**: Fill out all 12 questions to get recommendations
2. **Swipe Interface**: Swipe left (reject), right (like), or up (save)
3. **Vendor Submission**: Go to `/vendor` to submit a product
4. **Saved Items**: Click the saved button to view your saved products

## Production Considerations

1. **API Keys**: Ensure all API keys are properly secured
2. **Rate Limiting**: Implement rate limiting for API endpoints
3. **Caching**: Consider caching OpenAI responses
4. **Image Optimization**: Use proper CDN for product images
5. **Error Handling**: Implement comprehensive error boundaries
6. **Analytics**: Add tracking for user interactions
7. **Moderation**: Implement product moderation workflow

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for GPT-4 and Embeddings API
- Supabase for vector database capabilities
- shadcn/ui for beautiful UI components
- react-tinder-card for swipe functionality 