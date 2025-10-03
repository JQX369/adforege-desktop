/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Gifts Under $50 | Budget-Friendly Gift Ideas | FairyWize',
  description: 'Discover amazing gifts under $50 that don\'t compromise on quality or thoughtfulness. Perfect for any occasion with our AI-powered gift recommendations.',
  keywords: [
    'gifts under $50', 'budget gifts', 'affordable gifts',
    'cheap gift ideas', 'gifts under 50 dollars', 'inexpensive gifts',
    'budget friendly presents', 'gifts on a budget'
  ],
  openGraph: {
    title: 'Gifts Under $50 | Budget-Friendly Gift Ideas | FairyWize',
    description: 'Discover amazing gifts under $50 that don\'t compromise on quality or thoughtfulness. Perfect for any occasion with our AI-powered gift recommendations.',
    type: 'website',
    url: '/gift-guides/under-50',
  },
}

const budgetCategories = [
  {
    title: 'Under $25',
    description: 'Thoughtful gifts that make a big impact without breaking the bank',
    emoji: '🎁',
    priceRange: '$0-25',
    href: '/gift-guides/under-25',
  },
  {
    title: 'Under $50',
    description: 'Quality gifts that show you care, all within a reasonable budget',
    emoji: '💝',
    priceRange: '$25-50',
    href: '/gift-guides/under-50',
  },
  {
    title: 'Stocking Stuffers',
    description: 'Small, delightful items perfect for holiday stockings',
    emoji: '🧦',
    priceRange: '$5-20',
    href: '/gift-guides/stocking-stuffers',
  },
  {
    title: 'Experiences',
    description: 'Memorable experiences that cost less than traditional gifts',
    emoji: '🎭',
    priceRange: '$10-50',
    href: '/gift-guides/experience-gifts',
  },
  {
    title: 'Personalized Gifts',
    description: 'Custom items that feel expensive but stay within budget',
    emoji: '✨',
    priceRange: '$15-45',
    href: '/gift-guides/budget-personalized',
  },
  {
    title: 'Self-Care',
    description: 'Relaxing and pampering gifts for ultimate self-care',
    emoji: '🧘',
    priceRange: '$10-40',
    href: '/gift-guides/budget-self-care',
  },
]

export default function BudgetGiftsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">💰 Smart Budget Choices</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Gifts Under $50
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Amazing gifts don\'t have to cost a fortune. Discover thoughtful, high-quality presents
            that show you care without breaking the bank. Perfect for any occasion!
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-16">
          {budgetCategories.map((category) => (
            <Card key={category.href} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="text-2xl">{category.emoji}</div>
                  <Badge variant="outline" className="text-xs">
                    {category.priceRange}
                  </Badge>
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  <Link href={category.href} className="hover:underline">
                    {category.title}
                  </Link>
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={category.href}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Explore {category.title.toLowerCase()} →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Budget Tips */}
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl p-8 mb-16 border border-green-200/20">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            Budget Gift Shopping Tips
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">🎯 Focus on Thoughtfulness</h3>
              <p className="text-muted-foreground">
                The most meaningful gifts aren't always the most expensive. Our AI helps you find
                items that perfectly match the recipient\'s interests and personality.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">🛍️ Shop Smart</h3>
              <p className="text-muted-foreground">
                Look for sales, use coupon codes, and consider refurbished or gently used items
                from trusted sellers to stretch your budget even further.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">🎁 Bundle & Personalize</h3>
              <p className="text-muted-foreground">
                Combine smaller items into a themed gift basket or add personalization to make
                budget gifts feel more special and expensive.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">📱 Check Reviews</h3>
              <p className="text-muted-foreground">
                Read customer reviews to ensure quality. A well-reviewed $30 gift often provides
                more satisfaction than a poorly reviewed $100 item.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Need More Specific Ideas?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Tell our AI about the recipient\'s interests, personality, and your relationship,
            and we'll find the perfect budget-friendly gift just for them.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-300 font-medium"
          >
            Get Personalized Budget Gifts →
          </Link>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground">
          <h2>Budget-Friendly Gifts That Don't Feel Cheap</h2>
          <p>
            Finding meaningful gifts under $50 is easier than you think with FairyWize\'s AI-powered
            recommendation system. We understand that budget constraints don\'t mean you have to compromise
            on thoughtfulness or quality.
          </p>

          <h3>Why Choose Budget Gifts?</h3>
          <p>
            Budget-friendly gifts prove that it\'s the thought that counts. A carefully chosen $30 gift
            that perfectly matches someone\'s interests often means more than an expensive item they won\'t use.
            Our AI analyzes recipient preferences to ensure every suggestion hits the mark.
          </p>

          <h3>Popular Budget Gift Categories</h3>
          <p>
            Based on millions of searches, here are the most popular budget gift categories:
          </p>
          <ul>
            <li><strong>Self-Care Items:</strong> Candles, bath bombs, journals, and aromatherapy</li>
            <li><strong>Tech Accessories:</strong> Phone cases, chargers, and small gadgets</li>
            <li><strong>Personalized Items:</strong> Custom mugs, keychains, and photo gifts</li>
            <li><strong>Experiences:</strong> Gift cards, classes, and local experiences</li>
            <li><strong>Food & Treats:</strong> Gourmet snacks, coffee/tea sets, and baking kits</li>
          </ul>

          <h3>Maximizing Your Budget Gift Impact</h3>
          <p>
            Here are some strategies to make your budget gifts feel more special:
          </p>
          <ul>
            <li><strong>Add Personalization:</strong> Custom engraving or monogramming adds perceived value</li>
            <li><strong>Create Gift Sets:</strong> Combine 2-3 smaller items around a theme</li>
            <li><strong>Focus on Quality:</strong> Choose well-reviewed items from trusted brands</li>
            <li><strong>Consider Timing:</strong> Shop during sales events for additional savings</li>
            <li><strong>Think Experiences:</strong> Sometimes experiences create longer-lasting memories than physical items</li>
          </ul>

          <h3>FairyWize Budget Gift Guarantee</h3>
          <p>
            Every gift recommendation from FairyWize is carefully curated to ensure it provides genuine value.
            We only suggest items that real people love and use, regardless of price point.
          </p>
        </div>
      </div>
    </main>
  )
}
