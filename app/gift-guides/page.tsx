import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Gift Guides 2024 | FairyWize AI Gift Finder',
  description: 'Discover the ultimate gift guides for every occasion in 2024. From birthday gifts to holiday presents, find personalized recommendations with our AI-powered gift finder.',
  keywords: [
    'gift guides 2024', 'holiday gift guide', 'birthday gift ideas',
    'valentines gifts', 'christmas gifts', 'gift ideas for her',
    'gift ideas for him', 'gift recommendations'
  ],
  openGraph: {
    title: 'Gift Guides 2024 | FairyWize AI Gift Finder',
    description: 'Discover the ultimate gift guides for every occasion in 2024. From birthday gifts to holiday presents, find personalized recommendations with our AI-powered gift finder.',
    type: 'website',
    url: '/gift-guides',
  },
}

const giftGuides = [
  {
    title: 'Holiday Gift Guide 2024',
    description: 'The ultimate Christmas and holiday gift guide with AI-powered recommendations for everyone on your list.',
    href: '/gift-guides/holiday-2024',
    badge: '🎄 Seasonal',
    category: 'Holiday',
    searchVolume: '2.7M',
  },
  {
    title: 'Birthday Gift Ideas',
    description: 'Find the perfect birthday gifts for him, her, kids, and everyone special in your life.',
    href: '/gift-guides/birthday-gifts',
    badge: '🎂 Popular',
    category: 'Birthday',
    searchVolume: '1.2M',
  },
  {
    title: 'Valentine\'s Day Gifts',
    description: 'Romantic gift ideas for your partner, from thoughtful to luxurious options.',
    href: '/gift-guides/valentines-day',
    badge: '💝 Romantic',
    category: 'Valentine\'s',
    searchVolume: '890K',
  },
  {
    title: 'Mother\'s Day Gift Guide',
    description: 'Heartfelt gifts for moms who deserve the very best. Personalized recommendations included.',
    href: '/gift-guides/mothers-day',
    badge: '👩‍👧‍👦 Family',
    category: 'Mother\'s Day',
    searchVolume: '450K',
  },
  {
    title: 'Father\'s Day Gifts',
    description: 'Practical and thoughtful gifts for dads, from tech gadgets to personalized items.',
    href: '/gift-guides/fathers-day',
    badge: '👨‍👦‍👦 Family',
    category: 'Father\'s Day',
    searchVolume: '380K',
  },
  {
    title: 'Gifts Under $50',
    description: 'Amazing gifts that won\'t break the bank. Budget-friendly options for every occasion.',
    href: '/gift-guides/under-50',
    badge: '💰 Budget',
    category: 'Budget',
    searchVolume: '156K',
  },
  {
    title: 'Tech Gift Guide',
    description: 'Latest gadgets and tech accessories for the tech enthusiasts in your life.',
    href: '/gift-guides/tech-gifts',
    badge: '📱 Trending',
    category: 'Tech',
    searchVolume: '120K',
  },
  {
    title: 'Personalized Gifts',
    description: 'Custom and personalized gift ideas that show you really care about the details.',
    href: '/gift-guides/personalized',
    badge: '✨ Unique',
    category: 'Personalized',
    searchVolume: '450K',
  },
]

const categories = [
  { name: 'All Occasions', href: '/gift-guides', count: giftGuides.length },
  { name: 'Holiday & Seasonal', href: '/gift-guides/holiday', count: 1 },
  { name: 'Birthday', href: '/gift-guides/birthday', count: 1 },
  { name: 'Valentine\'s Day', href: '/gift-guides/valentines', count: 1 },
  { name: 'Mother\'s & Father\'s Day', href: '/gift-guides/family', count: 2 },
  { name: 'Budget-Friendly', href: '/gift-guides/budget', count: 1 },
  { name: 'Tech & Gadgets', href: '/gift-guides/tech', count: 1 },
  { name: 'Personalized', href: '/gift-guides/personalized-gifts', count: 1 },
]

export default function GiftGuidesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">🎁 Complete Gift Guide Collection</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            2024 Gift Guides
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Discover the perfect gifts for every occasion with our AI-powered gift guides.
            From holiday shopping to birthday presents, find personalized recommendations for everyone.
          </p>

          {/* Category Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={category.href}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-colors"
              >
                {category.name} ({category.count})
              </Link>
            ))}
          </div>
        </div>

        {/* Gift Guides Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {giftGuides.map((guide) => (
            <Card key={guide.href} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className="text-xs">
                    {guide.badge}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {guide.searchVolume} searches/mo
                  </span>
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  <Link href={guide.href} className="hover:underline">
                    {guide.title}
                  </Link>
                </CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {guide.category}
                  </Badge>
                  <Link
                    href={guide.href}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Explore Guide →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-8 border border-purple-200/20">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Can't find what you're looking for?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Use our AI-powered gift finder to get personalized recommendations based on the recipient's personality, interests, and your relationship.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 font-medium"
            >
              Try AI Gift Finder →
            </Link>
          </div>
        </div>

        {/* SEO Content */}
        <div className="mt-16 prose prose-lg max-w-4xl mx-auto text-muted-foreground">
          <h2>Why Choose FairyWize for Your Gift Shopping?</h2>
          <p>
            Finding the perfect gift can be challenging, but FairyWize makes it effortless with our AI-powered recommendation system.
            Unlike traditional gift guides, we ask you thoughtful questions about the recipient and use advanced artificial intelligence
            to suggest gifts they'll truly love.
          </p>

          <h3>Personalized Gift Recommendations</h3>
          <p>
            Our 12-question quiz captures the recipient's personality, interests, relationship to you, budget preferences,
            and occasion details to deliver highly personalized gift suggestions.
          </p>

          <h3>Curated by AI, Shopped by You</h3>
          <p>
            Each recommendation comes with direct shopping links to trusted retailers like Amazon, Etsy, and eBay,
            so you can purchase with confidence knowing you're getting quality products at fair prices.
          </p>

          <h3>Join Our Vendor Marketplace</h3>
          <p>
            Are you a maker or seller of unique gifts? Join our vendor marketplace and get discovered by thousands
            of gift-seekers using our platform. List your products and earn affiliate commissions on sales.
          </p>
        </div>
      </div>
    </main>
  )
}
