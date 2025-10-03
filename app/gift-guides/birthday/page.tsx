import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Birthday Gifts 2024 | Perfect Birthday Presents | FairyWize',
  description: 'Find the perfect birthday gifts for everyone in 2024. Unique birthday gift ideas for all ages, relationships, and budgets with AI-powered recommendations.',
  keywords: [
    'birthday gifts', 'birthday presents', 'birthday gift ideas',
    'unique birthday gifts', 'best birthday gifts', 'birthday surprises',
    'birthday gift guide', 'birthday presents 2024'
  ],
  openGraph: {
    title: 'Birthday Gifts 2024 | Perfect Birthday Presents | FairyWize',
    description: 'Find the perfect birthday gifts for everyone in 2024. Unique birthday gift ideas for all ages, relationships, and budgets with AI-powered recommendations.',
    url: 'https://fairywize.com/gift-guides/birthday',
  },
  twitter: {
    title: 'Birthday Gifts 2024 | Perfect Birthday Presents | FairyWize',
    description: 'Find the perfect birthday gifts for everyone in 2024. Unique birthday gift ideas for all ages, relationships, and budgets with AI-powered recommendations.',
  },
}

// ISR: Revalidate every 15 minutes
export const revalidate = 900

export default function BirthdayGiftsPage() {
  const ageCategories = [
    {
      title: 'Kids Birthday Gifts (5-12)',
      description: 'Fun toys, educational games, and creative activities for children.',
      image: '/images/birthday-kids.jpg',
      link: '/gifts?occasion=birthday&age=kids',
      popular: ['Building sets', 'Art supplies', 'Outdoor toys']
    },
    {
      title: 'Teen Birthday Gifts (13-19)',
      description: 'Tech gadgets, fashion items, and experience gifts for teenagers.',
      image: '/images/birthday-teens.jpg',
      link: '/gifts?occasion=birthday&age=teens',
      popular: ['Gaming accessories', 'Wireless earbuds', 'Concert tickets']
    },
    {
      title: 'Adult Birthday Gifts (20-39)',
      description: 'Lifestyle products, experiences, and personalized items for young adults.',
      image: '/images/birthday-adults.jpg',
      link: '/gifts?occasion=birthday&age=adults',
      popular: ['Smart home devices', 'Spa treatments', 'Adventure experiences']
    },
    {
      title: 'Mature Birthday Gifts (40+)',
      description: 'Quality items, luxury experiences, and meaningful keepsakes.',
      image: '/images/birthday-mature.jpg',
      link: '/gifts?occasion=birthday&age=mature',
      popular: ['Fine wines', 'Personalized jewelry', 'Weekend getaways']
    }
  ]

  const surpriseElements = [
    {
      title: 'Personalized Touches',
      description: 'Custom messages, engraved items, and memory-based gifts.',
      icon: '🎨'
    },
    {
      title: 'Experience Gifts',
      description: 'Tickets to events, classes, or adventure activities.',
      icon: '🎢'
    },
    {
      title: 'Subscription Boxes',
      description: 'Monthly deliveries of curated items or experiences.',
      icon: '📦'
    },
    {
      title: 'Group Gifts',
      description: 'Contributions from multiple people for bigger surprises.',
      icon: '👥'
    },
    {
      title: 'Memory Gifts',
      description: 'Photo books, custom videos, and sentimental items.',
      icon: '📸'
    },
    {
      title: 'Future Experiences',
      description: 'Gift cards for future adventures or special occasions.',
      icon: '🎁'
    }
  ]

  const budgetRanges = [
    {
      range: 'Under $25',
      description: 'Thoughtful small gifts and practical items',
      suggestions: ['Custom keychains', 'Scented candles', 'Artisanal chocolates', 'Book recommendations']
    },
    {
      range: '$25-$50',
      description: 'Quality items with personality',
      suggestions: ['Wireless chargers', 'Premium coffee', 'Personalized mugs', 'Subscription services']
    },
    {
      range: '$50-$100',
      description: 'Memorable and special gifts',
      suggestions: ['Experience vouchers', 'Tech accessories', 'Luxury grooming', 'Artisanal goods']
    },
    {
      range: '$100+',
      description: 'Luxury and once-in-a-lifetime gifts',
      suggestions: ['Weekend getaways', 'Smart home devices', 'Fine jewelry', 'Adventure experiences']
    }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">🎂 Birthday Magic</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Birthday Gifts That Wow
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Make their birthday unforgettable with personalized gift recommendations.
            From surprise experiences to meaningful keepsakes, find the perfect birthday present.
          </p>
        </div>

        {/* Age-Based Categories */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {ageCategories.map((category, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors text-lg">
                  {category.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {category.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Popular:</h4>
                  <div className="flex flex-wrap gap-1">
                    {category.popular.map((item, itemIndex) => (
                      <Badge key={itemIndex} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Link href={category.link} className="text-primary hover:underline font-medium text-sm">
                  Find Gifts →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Surprise Elements */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Add Surprise Elements
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {surpriseElements.map((element, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center">
                  <div className="text-3xl mb-4">{element.icon}</div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {element.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription>{element.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Budget Guide */}
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-2xl p-8 mb-16 border border-yellow-200/20">
          <h2 className="text-2xl md-text-3xl font-bold text-center mb-8">
            Birthday Gifts by Budget
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {budgetRanges.map((budget, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-xl">{budget.range}</CardTitle>
                  <CardDescription>{budget.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {budget.suggestions.map((suggestion, sugIndex) => (
                      <div key={sugIndex} className="flex items-center gap-2">
                        <span className="text-primary">•</span>
                        <span className="text-sm text-muted-foreground">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Special Occasions */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Milestone Birthdays
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="text-4xl mb-4">🎓</div>
              <h3 className="text-lg font-semibold mb-3">Sweet 16 / 18th</h3>
              <p className="text-muted-foreground text-sm">
                Coming of age celebrations with special meaning and future-focused gifts
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🎊</div>
              <h3 className="text-lg font-semibold mb-3">21st / 30th</h3>
              <p className="text-muted-foreground text-sm">
                Major life milestones deserving of memorable experiences and luxury items
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🎈</div>
              <h3 className="text-lg font-semibold mb-3">40th / 50th +</h3>
              <p className="text-muted-foreground text-sm">
                Reflection and celebration of life's achievements with meaningful keepsakes
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md-text-3xl font-bold mb-4">
            Create Birthday Magic with AI
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Tell us about the birthday person and let our AI craft personalized gift recommendations
            that will make their special day unforgettable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              Get Birthday Gift Ideas →
            </Link>
            <Link href="/gift-guides" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Explore All Guides →
            </Link>
          </div>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground">
          <h2>Birthday Gifts 2024: The Ultimate Gift Guide</h2>
          <p>
            Birthdays are special occasions that deserve thoughtful celebration. Whether you're
            shopping for a child, teenager, adult, or senior, our comprehensive birthday gift
            guide helps you find presents that create lasting memories and genuine joy.
          </p>

          <h3>Age-Appropriate Birthday Gift Selection</h3>
          <p>
            The best birthday gifts are tailored to the recipient's age and interests. Children
            might love toys and games, while adults may prefer experiences and personalized items.
            Understanding developmental stages and life experiences helps select more meaningful gifts.
          </p>

          <h3>Budget-Friendly Birthday Celebrations</h3>
          <p>
            You don't need to spend a fortune to create a memorable birthday. Many heartfelt gifts
            can be found across all budget ranges, from small thoughtful tokens to grand experiences.
            The key is selecting items that align with the recipient's personality and interests.
          </p>

          <h3>The Art of Birthday Surprises</h3>
          <p>
            Surprise elements can make birthday gifts even more special. Consider personalization,
            unexpected experiences, and items that reflect inside jokes or shared memories. The
            element of surprise often creates the most cherished birthday moments.
          </p>

          <h3>Milestone Birthday Considerations</h3>
          <p>
            Milestone birthdays like 16, 21, 30, 40, and 50 deserve special attention. These
            occasions often call for more significant gifts that mark important life transitions
            and achievements. Consider the recipient's life stage and future aspirations.
          </p>

          <h3>Timing Your Birthday Gift Purchase</h3>
          <p>
            Early planning allows for more thoughtful gift selection and better availability.
            Last-minute shopping can limit options, while advance planning enables more
            personalized and creative gift choices.
          </p>

          <h3>Group Gift Coordination</h3>
          <p>
            When multiple people want to contribute to a birthday gift, coordination becomes
            important. Clear communication about budgets and preferences ensures everyone
            contributes to a gift that truly delights the birthday person.
          </p>

          <h3>Experience vs Physical Gifts</h3>
          <p>
            Both physical gifts and experiences have their place in birthday celebrations.
            Physical gifts provide lasting keepsakes, while experiences create immediate
            memories. Consider combining both for a complete birthday celebration.
          </p>
        </div>
      </div>
    </main>
  )
}
