import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Holiday Gift Guide 2024 | Christmas Gifts & Seasonal Presents | FairyWize',
  description: 'Find the perfect Christmas gifts and holiday presents for 2024. Our AI-powered gift guide features personalized recommendations for family, friends, and colleagues.',
  keywords: [
    'holiday gift guide 2024', 'christmas gifts', 'holiday gifts',
    'christmas gift ideas', 'holiday presents', 'seasonal gifts',
    'gifts for christmas', 'holiday shopping guide'
  ],
  openGraph: {
    title: 'Holiday Gift Guide 2024 | Christmas Gifts & Seasonal Presents | FairyWize',
    description: 'Find the perfect Christmas gifts and holiday presents for 2024. Our AI-powered gift guide features personalized recommendations for family, friends, and colleagues.',
    type: 'website',
    url: '/gift-guides/holiday-2024',
  },
}

const holidayCategories = [
  {
    title: 'Gifts for Her',
    description: 'Thoughtful holiday gifts for wives, girlfriends, mothers, and sisters',
    emoji: '👩',
    searchVolume: '340K',
    href: '/gift-guides/holiday-gifts-for-her',
  },
  {
    title: 'Gifts for Him',
    description: 'Perfect holiday presents for husbands, boyfriends, fathers, and brothers',
    emoji: '👨',
    searchVolume: '280K',
    href: '/gift-guides/holiday-gifts-for-him',
  },
  {
    title: 'Gifts for Kids',
    description: 'Magical holiday gifts that will delight children of all ages',
    emoji: '🎁',
    searchVolume: '220K',
    href: '/gift-guides/holiday-gifts-for-kids',
  },
  {
    title: 'Tech Gifts',
    description: 'Latest gadgets and electronics for the tech lovers on your list',
    emoji: '📱',
    searchVolume: '180K',
    href: '/gift-guides/holiday-tech-gifts',
  },
  {
    title: 'Luxury Gifts',
    description: 'Premium holiday presents for those who appreciate the finer things',
    emoji: '✨',
    searchVolume: '120K',
    href: '/gift-guides/holiday-luxury-gifts',
  },
  {
    title: 'Budget-Friendly',
    description: 'Amazing holiday gifts under $50 that don\'t compromise on thoughtfulness',
    emoji: '💰',
    searchVolume: '95K',
    href: '/gift-guides/holiday-budget-gifts',
  },
]

export default function HolidayGiftGuidePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">🎄 Holiday Season 2024</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Holiday Gift Guide 2024
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Make this holiday season magical with our curated collection of Christmas gifts and seasonal presents.
            From thoughtful stocking stuffers to show-stopping main gifts, find something perfect for everyone.
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-16">
          {holidayCategories.map((category) => (
            <Card key={category.href} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="text-2xl">{category.emoji}</div>
                  <Badge variant="outline" className="text-xs">
                    {category.searchVolume} searches/mo
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

        {/* Featured Holiday Tips */}
        <div className="bg-gradient-to-r from-green-500/10 to-red-500/10 rounded-2xl p-8 mb-16 border border-green-200/20">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            Holiday Shopping Tips from FairyWize AI
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">🎯 Start Early, Shop Smart</h3>
              <p className="text-muted-foreground">
                Holiday shopping demand peaks in December. Start your shopping in November to avoid
                shipping delays and ensure the best selection of popular items.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">💝 Personalization Wins</h3>
              <p className="text-muted-foreground">
                Our AI analyzes recipient preferences to suggest truly personalized gifts.
                The more details you provide, the better the recommendations become.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">🛍️ Mix Online & Local</h3>
              <p className="text-muted-foreground">
                Combine our online recommendations with local shopping. Many retailers offer
                in-store pickup for online orders, giving you the best of both worlds.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">📦 Plan for Shipping</h3>
              <p className="text-muted-foreground">
                Factor in shipping times when ordering. Most retailers have cutoff dates for
                guaranteed holiday delivery - plan accordingly to avoid disappointment.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Still Need More Gift Ideas?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Use our AI-powered gift finder for personalized recommendations based on the recipient's
            personality, interests, and your relationship with them.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-green-600 to-red-600 text-white rounded-lg hover:from-green-700 hover:to-red-700 transition-all duration-300 font-medium"
          >
            Find Personalized Gifts →
          </Link>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground">
          <h2>The Ultimate Holiday Gift Guide for 2024</h2>
          <p>
            The holiday season is upon us, and finding the perfect gifts for your loved ones can feel overwhelming.
            That's where FairyWize comes in - our AI-powered gift recommendation platform makes holiday shopping
            effortless and enjoyable.
          </p>

          <h3>Why FairyWize for Holiday Shopping?</h3>
          <p>
            Unlike traditional gift guides that offer generic suggestions, FairyWize uses advanced artificial
            intelligence to understand the unique preferences and personality of each gift recipient. Our
            12-question quiz captures everything from their interests and hobbies to your relationship with them,
            ensuring every recommendation is truly personalized.
          </p>

          <h3>Holiday Gift Trends for 2024</h3>
          <p>
            This year, we're seeing a surge in personalized and experiential gifts. People are moving away
            from generic presents toward items that reflect the recipient's individual personality and create
            lasting memories. Our AI algorithm identifies these trends and matches them with your specific needs.
          </p>

          <h3>Stress-Free Holiday Shopping</h3>
          <p>
            The holiday rush doesn't have to be stressful. With FairyWize, you can:
          </p>
          <ul>
            <li>Get personalized gift recommendations in minutes</li>
            <li>Shop directly from trusted retailers with affiliate links</li>
            <li>Save your favorite items for later</li>
            <li>Get suggestions for any budget or occasion</li>
            <li>Join our vendor marketplace to sell your own unique gifts</li>
          </ul>

          <h3>Perfect for Every Relationship</h3>
          <p>
            Whether you're shopping for family members, friends, colleagues, or that special someone,
            our AI understands the nuances of different relationships and suggests appropriate gifts accordingly.
          </p>
        </div>
      </div>
    </main>
  )
}
