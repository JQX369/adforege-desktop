import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Gifts for Her 2024 | Best Presents for Women | FairyWize',
  description: 'Discover perfect gifts for her in 2024. From luxury items to thoughtful gestures, find personalized gift ideas for girlfriends, wives, moms, and female friends.',
  keywords: [
    'gifts for her', 'gifts for women', 'gifts for girlfriend',
    'gifts for wife', 'gifts for mom', 'womens gifts',
    'birthday gifts for her', 'christmas gifts for women'
  ],
  openGraph: {
    title: 'Gifts for Her 2024 | Best Presents for Women | FairyWize',
    description: 'Discover perfect gifts for her in 2024. From luxury items to thoughtful gestures, find personalized gift ideas for girlfriends, wives, moms, and female friends.',
    url: 'https://fairywize.com/gift-guides/for-her',
  },
  twitter: {
    title: 'Gifts for Her 2024 | Best Presents for Women | FairyWize',
    description: 'Discover perfect gifts for her in 2024. From luxury items to thoughtful gestures, find personalized gift ideas for girlfriends, wives, moms, and female friends.',
  },
}

// ISR: Revalidate every 15 minutes
export const revalidate = 900

export default function GiftsForHerPage() {
  const giftCategories = [
    {
      title: 'Luxury & Spa Gifts',
      description: 'Indulgent spa treatments, premium skincare, and luxury bath products.',
      image: '/images/for-her-luxury.jpg',
      link: '/gifts?category=luxury-spa&recipient=her',
      priceRange: '$50-$500+'
    },
    {
      title: 'Jewelry & Accessories',
      description: 'Elegant necklaces, bracelets, earrings, and statement accessories.',
      image: '/images/for-her-jewelry.jpg',
      link: '/gifts?category=jewelry&recipient=her',
      priceRange: '$25-$1000+'
    },
    {
      title: 'Fashion & Clothing',
      description: 'Stylish clothing, scarves, handbags, and fashion accessories.',
      image: '/images/for-her-fashion.jpg',
      link: '/gifts?category=fashion&recipient=her',
      priceRange: '$30-$300+'
    },
    {
      title: 'Books & Learning',
      description: 'Bestselling novels, inspirational books, and online courses.',
      image: '/images/for-her-books.jpg',
      link: '/gifts?category=books-learning&recipient=her',
      priceRange: '$15-$100+'
    },
    {
      title: 'Home & Lifestyle',
      description: 'Candles, diffusers, throw blankets, and home decor items.',
      image: '/images/for-her-home.jpg',
      link: '/gifts?category=home-lifestyle&recipient=her',
      priceRange: '$20-$200+'
    },
    {
      title: 'Experience Gifts',
      description: 'Spa days, cooking classes, wine tastings, and adventure experiences.',
      image: '/images/for-her-experiences.jpg',
      link: '/gifts?category=experiences&recipient=her',
      priceRange: '$50-$500+'
    },
    {
      title: 'Tech & Gadgets',
      description: 'Smart home devices, fitness trackers, and innovative gadgets.',
      image: '/images/for-her-tech.jpg',
      link: '/gifts?category=tech-gadgets&recipient=her',
      priceRange: '$30-$400+'
    },
    {
      title: 'Personalized Gifts',
      description: 'Custom jewelry, monogrammed items, and bespoke presents.',
      image: '/images/for-her-personalized.jpg',
      link: '/gifts?category=personalized&recipient=her',
      priceRange: '$25-$300+'
    }
  ]

  const relationshipGuides = [
    {
      title: 'Gifts for Your Girlfriend',
      description: 'Romantic and thoughtful gifts that show you care',
      tips: ['Focus on sentimental value', 'Consider her hobbies', 'Quality over quantity'],
      popular: ['Custom jewelry', 'Experience gifts', 'Spa treatments']
    },
    {
      title: 'Gifts for Your Wife',
      description: 'Meaningful presents for your life partner',
      tips: ['Personalized touches', 'Shared experiences', 'Luxury items she deserves'],
      popular: ['Fine jewelry', 'Weekend getaways', 'Home improvements']
    },
    {
      title: 'Gifts for Mom',
      description: 'Special gifts to honor the most important woman',
      tips: ['Sentimental value', 'Practical help', 'Family-focused gifts'],
      popular: ['Photo gifts', 'Spa days', 'Kitchen gadgets']
    },
    {
      title: 'Gifts for Female Friends',
      description: 'Thoughtful presents for your closest girlfriends',
      tips: ['Inside jokes matter', 'Shared interests', 'Fun and unique items'],
      popular: ['Novelty gifts', 'Book recommendations', 'Accessory sets']
    }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">💖 For Her</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Perfect Gifts for Her 2024
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover curated gift ideas for the special women in your life. From romantic gestures
            to thoughtful surprises, find presents she'll truly love.
          </p>
        </div>

        {/* Gift Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {giftCategories.map((category, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors text-lg">
                  {category.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {category.priceRange}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {category.description}
                </p>
                <Link href={category.link} className="text-primary hover:underline font-medium text-sm">
                  Explore Gifts →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Relationship Guides */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Gift Ideas by Relationship
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {relationshipGuides.map((guide, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {guide.title}
                  </CardTitle>
                  <CardDescription>{guide.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">Pro Tips:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {guide.tips.map((tip, tipIndex) => (
                        <li key={tipIndex}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Popular Gifts:</h4>
                    <div className="flex flex-wrap gap-2">
                      {guide.popular.map((item, itemIndex) => (
                        <Badge key={itemIndex} variant="outline" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Seasonal Considerations */}
        <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-2xl p-8 mb-16 border border-pink-200/20">
          <h2 className="text-2xl md-text-3xl font-bold text-center mb-6">
            Seasonal Gift Inspiration
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-3">🌸 Spring Gifts</h3>
              <p className="text-muted-foreground text-sm">
                Fresh flowers, light scents, outdoor adventures, and renewal-themed gifts
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-3">☀️ Summer Gifts</h3>
              <p className="text-muted-foreground text-sm">
                Beach accessories, travel gear, fitness items, and refreshing experiences
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-3">🎄 Holiday Gifts</h3>
              <p className="text-muted-foreground text-sm">
                Cozy items, luxury treats, family experiences, and festive surprises
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md-text-3xl font-bold mb-4">
            Find Her Perfect Gift with AI
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Let FairyWize's AI analyze her preferences and recommend personalized gifts
            she'll absolutely love.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              Get AI Recommendations →
            </Link>
            <Link href="/gift-guides" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Browse More Guides →
            </Link>
          </div>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground">
          <h2>Gift Ideas for Women: Thoughtful Presents for Every Occasion</h2>
          <p>
            Finding the perfect gift for her doesn't have to be stressful. Whether it's for your
            girlfriend, wife, mother, or female friend, our curated selection of gifts for women
            covers everything from romantic gestures to practical essentials.
          </p>

          <h3>Understanding What Women Want in Gifts</h3>
          <p>
            While preferences vary by individual, women often appreciate gifts that show thoughtfulness,
            quality, and personalization. Consider her interests, lifestyle, and the occasion when
            selecting gifts for her.
          </p>

          <h3>Gift Categories That Always Impress</h3>
          <ul>
            <li><strong>Luxury Spa Products:</strong> High-end skincare, bath bombs, and aromatherapy items</li>
            <li><strong>Fine Jewelry:</strong> Timeless pieces that never go out of style</li>
            <li><strong>Personalized Items:</strong> Custom-engraved jewelry, monogrammed accessories</li>
            <li><strong>Experience Gifts:</strong> Spa days, cooking classes, or adventure activities</li>
            <li><strong>Books and Learning:</strong> Best-selling novels or skill-building courses</li>
          </ul>

          <h3>Relationship-Based Gift Strategies</h3>
          <p>
            Different relationships call for different gift approaches. A romantic gift for your
            girlfriend might focus on sentiment, while gifts for mom could emphasize family
            and practicality.
          </p>

          <h3>Budget-Friendly vs Luxury Gifts for Her</h3>
          <p>
            Quality doesn't always mean expensive. Many meaningful gifts for women can be found
            under $50, while luxury options provide elevated experiences for special occasions.
          </p>

          <h3>Seasonal and Occasion-Based Gifts</h3>
          <p>
            Tailor your gift selection to the season or occasion. Spring gifts might focus on
            renewal and fresh starts, while holiday gifts could emphasize comfort and celebration.
          </p>

          <h3>The Power of Personalization</h3>
          <p>
            Adding a personal touch can transform any gift from ordinary to extraordinary.
            Consider customization options like engraving, color preferences, or items that
            reflect shared memories and inside jokes.
          </p>
        </div>
      </div>
    </main>
  )
}
