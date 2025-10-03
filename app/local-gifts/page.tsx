'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface LocalBusiness {
  name: string
  type: string
  description: string
  address: string
  phone?: string
  website?: string
  distance?: string
  rating?: number
  category: string
}

export default function LocalGiftsPage() {
  const [location, setLocation] = useState('')
  const [searchResults, setSearchResults] = useState<LocalBusiness[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Mock local businesses data - in real implementation, this would come from an API
  const mockBusinesses = useMemo<LocalBusiness[]>(() => [
    {
      name: "Sarah's Gift Boutique",
      type: "Gift Shop",
      description: "Handcrafted jewelry, candles, and personalized gifts",
      address: "123 Main St, Downtown",
      phone: "(555) 123-4567",
      website: "https://sarahsgifts.com",
      distance: "0.3 miles",
      rating: 4.8,
      category: "Boutique"
    },
    {
      name: "The Artisan Collective",
      type: "Artisan Market",
      description: "Local makers showcase handmade ceramics, art, and crafts",
      address: "456 Artisan Way, Arts District",
      phone: "(555) 987-6543",
      distance: "0.8 miles",
      rating: 4.6,
      category: "Artisan"
    },
    {
      name: "Vintage Finds & Gifts",
      type: "Vintage Shop",
      description: "Unique vintage items, antiques, and retro gifts",
      address: "789 Vintage Blvd, Historic District",
      phone: "(555) 456-7890",
      website: "https://vintagefinds.com",
      distance: "1.2 miles",
      rating: 4.4,
      category: "Vintage"
    },
    {
      name: "Bloom & Blossom",
      type: "Flower & Gift Shop",
      description: "Fresh flowers, plants, and botanical-themed gifts",
      address: "321 Garden Ave, Garden District",
      phone: "(555) 234-5678",
      distance: "0.5 miles",
      rating: 4.7,
      category: "Floral"
    },
    {
      name: "Tech Haven Gifts",
      type: "Electronics & Gadgets",
      description: "Latest tech gadgets, accessories, and smart home gifts",
      address: "654 Tech Park, Innovation District",
      phone: "(555) 345-6789",
      website: "https://techhavengifts.com",
      distance: "1.5 miles",
      rating: 4.5,
      category: "Tech"
    },
    {
      name: "Sweet Memories Chocolate",
      type: "Chocolatier & Gifts",
      description: "Artisanal chocolates, gift baskets, and sweet treats",
      address: "987 Dessert Lane, Food District",
      phone: "(555) 567-8901",
      distance: "0.7 miles",
      rating: 4.9,
      category: "Food"
    }
  ], [])

  const handleLocationSearch = useCallback(async () => {
    setIsLoading(true)
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSearchResults(mockBusinesses)
    setIsLoading(false)
  }, [mockBusinesses])

  useEffect(() => {
    // Set page title and meta description for SEO
    document.title = 'Local Gift Shops Near Me | Find Boutiques & Gift Stores | FairyWize'

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (!metaDescription) {
      metaDescription = document.createElement('meta') as HTMLMetaElement
      metaDescription.name = 'description'
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute('content', 'Discover local gift shops, boutiques, and specialty stores in your area. Support local businesses and find unique, handcrafted gifts near you.')

    // Auto-detect location if geolocation is available
    if (navigator.geolocation && !location) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, you'd reverse geocode the coordinates
          setLocation('Current Location')
          handleLocationSearch()
        },
        (error) => {
          console.log('Geolocation error:', error)
        }
      )
    }
  }, [location, handleLocationSearch])

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">📍 Local Discovery</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Local Gift Shops Near You
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Support local businesses and discover unique, handcrafted gifts in your neighborhood.
            From artisan markets to specialty boutiques, find the perfect local treasures.
          </p>

          {/* Location Search */}
          <div className="max-w-md mx-auto mb-8">
            <div className="flex gap-2">
              <Input
                placeholder="Enter your city or zip code"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleLocationSearch} disabled={isLoading}>
                {isLoading ? 'Searching...' : 'Find Shops'}
              </Button>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-center">
              Gift Shops Near {location || 'You'}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {searchResults.map((business, index) => (
                <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {business.category}
                      </Badge>
                      {business.distance && (
                        <span className="text-xs text-muted-foreground">
                          {business.distance}
                        </span>
                      )}
                    </div>
                    <CardTitle className="group-hover:text-primary transition-colors">
                      {business.name}
                    </CardTitle>
                    <CardDescription>{business.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {business.description}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">📍</span>
                        <span>{business.address}</span>
                      </div>
                      {business.phone && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">📞</span>
                          <span>{business.phone}</span>
                        </div>
                      )}
                      {business.website && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">🌐</span>
                          <a
                            href={business.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Visit Website
                          </a>
                        </div>
                      )}
                      {business.rating && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">⭐</span>
                          <span>{business.rating}/5.0</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Local SEO Benefits */}
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl p-8 mb-16 border border-green-200/20">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            Why Shop Local for Gifts?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">🏪 Support Local Economy</h3>
              <p className="text-muted-foreground">
                Shopping at local gift shops keeps money in your community and supports local families and entrepreneurs.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">🎨 Unique & Handcrafted</h3>
              <p className="text-muted-foreground">
                Find one-of-a-kind, artisanal gifts that you won't find in big box stores or online marketplaces.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">🤝 Personal Service</h3>
              <p className="text-muted-foreground">
                Get personalized recommendations and gift-wrapping services from knowledgeable local shop owners.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">🌱 Sustainable Choice</h3>
              <p className="text-muted-foreground">
                Reduce shipping emissions and packaging waste by shopping locally for your gift needs.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md-text-3xl font-bold mb-4">
            Need Personalized Gift Ideas?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            While you're exploring local shops, use our AI-powered gift finder for personalized
            recommendations that complement your local discoveries.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <a href="/">
                Try AI Gift Finder →
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/gift-guides">
                Browse Gift Guides →
              </a>
            </Button>
          </div>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground">
          <h2>Discover Local Gift Shops and Boutiques</h2>
          <p>
            Shopping for gifts locally offers a unique experience that online shopping simply can't match.
            Local gift shops, boutiques, and artisan markets provide personalized service, unique products,
            and the satisfaction of supporting your community's economy.
          </p>

          <h3>Types of Local Gift Shops</h3>
          <p>
            Every community has its own collection of special gift destinations:
          </p>
          <ul>
            <li><strong>Boutiques:</strong> Curated selections of fashion, jewelry, and accessories</li>
            <li><strong>Artisan Markets:</strong> Handcrafted items from local makers and artists</li>
            <li><strong>Specialty Stores:</strong> Shops focused on specific themes like vintage, tech, or floral</li>
            <li><strong>Department Store Gift Sections:</strong> Dedicated gift areas in larger retail locations</li>
          </ul>

          <h3>Benefits of Local Gift Shopping</h3>
          <p>
            Beyond finding unique items, shopping locally for gifts provides numerous advantages:
          </p>
          <ul>
            <li><strong>Immediate Gratification:</strong> Take your gift home today, no shipping wait times</li>
            <li><strong>Gift Wrapping Services:</strong> Professional wrapping often available on-site</li>
            <li><strong>Local Expertise:</strong> Shop owners know their inventory and can offer personalized suggestions</li>
            <li><strong>Community Connection:</strong> Build relationships with local business owners</li>
            <li><strong>Environmental Benefits:</strong> Reduce carbon footprint compared to shipped online orders</li>
          </ul>

          <h3>Finding Local Gift Shops Near You</h3>
          <p>
            Use our local gift shop finder to discover hidden gems in your area. Simply enter your location
            and we'll show you the best local options for unique, thoughtful gifts.
          </p>
        </div>
      </div>
    </main>
  )
}