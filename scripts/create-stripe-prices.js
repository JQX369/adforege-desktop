// Run this script to create Stripe Price IDs for your products
// Usage: node scripts/create-stripe-prices.js

const Stripe = require('stripe')

async function createPrices() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  console.log('Creating Stripe prices for subscription products...\n')

  // Note: The environment variables show product IDs, but we need to create recurring prices
  // You'll need to first create the products in Stripe Dashboard or via API

  const products = [
    {
      name: 'Basic',
      productId: 'prod_SsXYuqx29uA2A9',
      price: 900, // $9.00 in cents
      envVar: 'STRIPE_PRICE_BASIC',
    },
    {
      name: 'Featured',
      productId: 'prod_SsXYQALhOmVZmB',
      price: 3900, // $39.00 in cents
      envVar: 'STRIPE_PRICE_FEATURED',
    },
    {
      name: 'Premium',
      productId: 'prod_SsXZnjSyD0zqq5',
      price: 9900, // $99.00 in cents
      envVar: 'STRIPE_PRICE_PREMIUM',
    },
  ]

  console.log('Instructions to create prices in Stripe Dashboard:\n')
  console.log('1. Go to https://dashboard.stripe.com/products')
  console.log('2. For each product, click on it and add a recurring price')
  console.log('3. Set the following prices:\n')

  for (const product of products) {
    console.log(`${product.name} (${product.productId}):`)
    console.log(`  - Amount: $${product.price / 100}.00`)
    console.log(`  - Billing period: Monthly`)
    console.log(`  - Currency: USD`)
    console.log(
      `  - After creating, copy the Price ID (starts with price_) and add to .env.local:`
    )
    console.log(`  - ${product.envVar}=price_xxxxx\n`)
  }

  console.log(
    '\nAlternatively, run this code to create prices programmatically:'
  )
  console.log('(Uncomment the code below and run again)\n')

  /*
  for (const product of products) {
    try {
      const price = await stripe.prices.create({
        product: product.productId,
        unit_amount: product.price,
        currency: 'usd',
        recurring: {
          interval: 'month'
        }
      });
      
      console.log(`Created price for ${product.name}:`);
      console.log(`  ${product.envVar}=${price.id}`);
    } catch (error) {
      console.error(`Error creating price for ${product.name}:`, error.message);
    }
  }
  */
}

createPrices()
