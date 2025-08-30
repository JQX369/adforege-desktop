-- Add optional Stripe fields for vendor payments
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT UNIQUE;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

