const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database with sample products...')

  // Create sample products for testing
  const sampleProducts = [
    {
      id: 'sample-1',
      title: 'Wireless Bluetooth Headphones',
      description: 'High-quality wireless headphones with noise cancellation and 30-hour battery life.',
      price: 89.99,
      images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
      affiliateUrl: 'https://amazon.com/dp/B08N5WRWNW',
      categories: ['Electronics', 'Audio', 'Technology'],
      embedding: new Array(1536).fill(0.1), // Placeholder embedding
      status: 'APPROVED',
      currency: 'USD',
      brand: 'TechBrand',
      qualityScore: 0.8,
      recencyScore: 0.9,
      popularityScore: 0.7,
      availability: 'IN_STOCK',
      source: 'CURATED',
    },
    {
      id: 'sample-2',
      title: 'Art Supplies Kit',
      description: 'Complete art supplies kit with paints, brushes, canvas, and easel for creative projects.',
      price: 45.99,
      images: ['https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=500'],
      affiliateUrl: 'https://amazon.com/dp/B08N5WRWNW',
      categories: ['Art', 'Creative', 'Hobbies'],
      embedding: new Array(1536).fill(0.2), // Placeholder embedding
      status: 'APPROVED',
      currency: 'USD',
      brand: 'ArtBrand',
      qualityScore: 0.9,
      recencyScore: 0.8,
      popularityScore: 0.6,
      availability: 'IN_STOCK',
      source: 'CURATED',
    },
    {
      id: 'sample-3',
      title: 'Music Production Software',
      description: 'Professional music production software with virtual instruments and effects.',
      price: 199.99,
      images: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500'],
      affiliateUrl: 'https://amazon.com/dp/B08N5WRWNW',
      categories: ['Music', 'Software', 'Digital'],
      embedding: new Array(1536).fill(0.3), // Placeholder embedding
      status: 'APPROVED',
      currency: 'USD',
      brand: 'MusicBrand',
      qualityScore: 0.95,
      recencyScore: 0.7,
      popularityScore: 0.8,
      availability: 'IN_STOCK',
      source: 'CURATED',
    },
  ]

  for (const product of sampleProducts) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    })
    console.log(`✅ Created product: ${product.title}`)
  }

  console.log('🌱 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
