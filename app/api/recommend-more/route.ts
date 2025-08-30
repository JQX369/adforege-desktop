import { NextRequest, NextResponse } from 'next/server'
import { searchGiftProducts, buildPerplexityQuery } from '@/lib/perplexity'
import { buildAffiliateUrl } from '@/lib/affiliates'

export async function POST(request: NextRequest) {
  try {
    const { formData, page = 1 } = await request.json()

    if (!formData) {
      return NextResponse.json(
        { error: 'Form data is required' },
        { status: 400 }
      )
    }

    // Search for more products using Perplexity with page offset
    const searchQuery = buildPerplexityQuery(formData) + ` (page ${page + 1}, different from previous)`
    const searchResults = await searchGiftProducts(searchQuery)
    
    const recommendations = searchResults.map((product) => ({
      id: `search-${Date.now()}-${Math.random()}`,
      title: product.title,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl || '',
      affiliateUrl: buildAffiliateUrl(product.url),
      matchScore: 0.7 + Math.random() * 0.3, // Random score between 0.7-1.0
      categories: product.categories,
      isVendor: false,
      isSearchResult: true,
    }))

    return NextResponse.json({
      recommendations,
      page,
      hasMore: recommendations.length >= 12,
    })
  } catch (error) {
    console.error('Error in recommend-more API:', error)
    return NextResponse.json(
      { error: 'Failed to get more recommendations' },
      { status: 500 }
    )
  }
} 