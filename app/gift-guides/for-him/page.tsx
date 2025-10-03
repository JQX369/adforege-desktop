import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Gifts for Him 2024 | Best Presents for Men | FairyWize',
  description: 'Discover perfect gifts for him in 2024. From tech gadgets to adventure experiences, find personalized gift ideas for boyfriends, husbands, dads, and male friends.',
  keywords: [
    'gifts for him', 'gifts for men', 'gifts for boyfriend',
    'gifts for husband', 'gifts for dad', 'mens gifts',
    'birthday gifts for him', 'christmas gifts for men'
  ],
  openGraph: {
    title: 'Gifts for Him 2024 | Best Presents for Men | FairyWize',
    description: 'Discover perfect gifts for him in 2024. From tech gadgets to adventure experiences, find personalized gift ideas for boyfriends, husbands, dads, and male friends.',
    url: 'https://fairywize.com/gift-guides/for-him',
  },
  twitter: {
    title: 'Gifts for Him 2024 | Best Presents for Men | FairyWize',
    description: 'Discover perfect gifts for him in 2024. From tech gadgets to adventure experiences, find personalized gift ideas for boyfriends, husbands, dads, and male friends.',
  },
}

// ISR: Revalidate every 15 minutes
export const revalidate = 900

export default function GiftsForHimPage() {
  const giftCategories = [
    {
      title: 'Tech & Gadgets',
      description: 'Smartphones, smartwatches, gaming accessories, and innovative tech.',
      image: '/images/for-him-tech.jpg',
      link: '/gifts?category=tech-gadgets&recipient=him',
      priceRange: '$30-$1000+'
    },
    {
      title: 'Outdoor & Adventure',
      description: 'Hiking gear, camping equipment, sports accessories, and adventure experiences.',
      image: '/images/for-him-outdoor.jpg',
      link: '/gifts?category=outdoor-adventure&recipient=him',
      priceRange: '$25-$500+'
    },
    {
      title: 'Grooming & Style',
      description: 'Premium grooming products, cologne, watches, and fashion accessories.',
      image: '/images/for-him-grooming.jpg',
      link: '/gifts?category=grooming-style&recipient=him',
      priceRange: '$20-$300+'
    },
    {
      title: 'Books & Learning',
      description: 'Bestselling books, biographies, skill-building courses, and audiobooks.',
      image: '/images/for-him-books.jpg',
      link: '/gifts?category=books-learning&recipient=him',
      priceRange: '$15-$100+'
    },
    {
      title: 'Home & BBQ',
      description: 'Grilling tools, home brewing kits, smart home devices, and comfort items.',
      image: '/images/for-him-home.jpg',
      link: '/gifts?category=home-bbq&recipient=him',
      priceRange: '$25-$200+'
    },
    {
      title: 'Experience Gifts',
      description: 'Concert tickets, sports events, adventure activities, and classes.',
      image: '/images/for-him-experiences.jpg',
      link: '/gifts?category=experiences&recipient=him',
      priceRange: '$50-$500+'
    },
    {
      title: 'Sports & Fitness',
      description: 'Workout gear, fitness trackers, sports equipment, and activewear.',
      image: '/images/for-him-sports.jpg',
      link: '/gifts?category=sports-fitness&recipient=him',
      priceRange: '$30-$400+'
    },
    {
      title: 'Personalized Gifts',
      description: 'Custom engraved items, monogrammed accessories, and bespoke presents.',
      image: '/images/for-him-personalized.jpg',
      link: '/gifts?category=personalized&recipient=him',
      priceRange: '$25-$300+'
    }
  ]

  const relationshipGuides = [
    {
      title: 'Gifts for Your Boyfriend',
      description: 'Cool and thoughtful gifts that match his interests',
      tips: ['Focus on his hobbies', 'Practical yet fun items', 'Shared activities'],
      popular: ['Tech gadgets', 'Experience gifts', 'Sports equipment']
    },
    {
      title: 'Gifts for Your Husband',
      description: 'Meaningful presents for your life partner',
      tips: ['Quality over quantity', 'Personalized touches', 'Luxury experiences'],
      popular: ['Smart home tech', 'Weekend adventures', 'Premium grooming']
    },
    {
      title: 'Gifts for Dad',
      description: 'Special gifts to honor your father',
      tips: ['Practical solutions', 'Family activities', 'His favorite hobbies'],
      popular: ['Grilling tools', 'Outdoor gear', 'Personalized items']
    },
    {
      title: 'Gifts for Male Friends',
      description: 'Fun and unique presents for your buddies',
      tips: ['Inside jokes welcome', 'Group activities', 'Novelty items'],
      popular: ['Gadgets', 'Beer-making kits', 'Sports tickets']
    }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">🚀 For Him</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Perfect Gifts for Him 2024
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover curated gift ideas for the important men in your life. From tech gadgets
            to adventure experiences, find presents he'll actually use and love.
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

        {/* Age and Interest-Based Gifts */}
        <div className="bg-gradient-to-r from-blue-500/10 to-green-500/10 rounded-2xl p-8 mb-16 border border-blue-200/20">
          <h2 className="text-2xl md-text-3xl font-bold text-center mb-6">
            Gifts by Age & Interests
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-3">🎮 Young Professionals (20s-30s)</h3>
              <p className="text-muted-foreground text-sm">
                Tech gadgets, fitness gear, experience gifts, and smart accessories
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-3">🏠 Family Men (30s-50s)</h3>
              <p className="text-muted-foreground text-sm">
                Home improvement tools, family experiences, luxury watches, and BBQ gear
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-3">🎯 Mature Gentlemen (50s+)</h3>
              <p className="text-muted-foreground text-sm">
                Premium whiskey stones, golf accessories, classic books, and relaxation items
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md-text-3xl font-bold mb-4">
            Find His Perfect Gift with AI
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Let FairyWize's AI analyze his interests and recommend personalized gifts
            he'll be excited to receive.
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
          <h2>Gift Ideas for Men: Practical and Impressive Presents</h2>
          <p>
            Finding the right gift for him can be challenging, but with our comprehensive guide
            to gifts for men, you'll discover options that range from practical tools to exciting
            adventures. Whether it's for your boyfriend, husband, father, or male friend, we have
            curated suggestions for every type of man.
          </p>

          <h3>Understanding What Men Want in Gifts</h3>
          <p>
            While preferences vary, men often appreciate gifts that are functional, high-quality,
            and tied to their interests. Consider his hobbies, lifestyle, and the type of activities
            he enjoys when selecting gifts for him.
          </p>

          <h3>Top Gift Categories for Men</h3>
          <ul>
            <li><strong>Technology & Gadgets:</strong> Smart devices, gaming accessories, and innovative tools</li>
            <li><strong>Outdoor & Adventure:</strong> Camping gear, sports equipment, and experience activities</li>
            <li><strong>Grooming Products:</strong> Premium skincare, cologne, and personal care items</li>
            <li><strong>Experience Gifts:</strong> Tickets to events, classes, or adventure experiences</li>
            <li><strong>Home & Hobbies:</strong> Grilling tools, home brewing kits, and specialized equipment</li>
          </ul>

          <h3>Relationship-Based Gift Strategies</h3>
          <p>
            Different relationships require different approaches. Gifts for your boyfriend might focus
            on fun and shared activities, while gifts for dad could emphasize practicality and family
            bonding experiences.
          </p>

          <h3>Age-Appropriate Gift Selection</h3>
          <p>
            Consider the recipient's age and life stage when choosing gifts. Young professionals might
            appreciate tech gadgets and fitness gear, while family men may prefer home improvement tools
            and family experiences.
          </p>

          <h3>Budget Considerations for Men's Gifts</h3>
          <p>
            Quality gifts don't have to be expensive. Many impressive gifts for men can be found
            across various price ranges, from budget-friendly gadgets to luxury experiences.
          </p>

          <h3>The Appeal of Experience Gifts</h3>
          <p>
            Experience gifts are increasingly popular for men. Tickets to concerts, sports events,
            cooking classes, or adventure activities create lasting memories and shared experiences.
          </p>

          <h3>Personalization Matters</h3>
          <p>
            Adding a personal touch can make any gift more meaningful. Custom engraving, color
            customization, or items that reflect shared interests can transform a good gift into
            a great one.
          </p>
        </div>
      </div>
    </main>
  )
}
