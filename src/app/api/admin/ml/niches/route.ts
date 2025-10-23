import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    // Get niche insights
    const niches = {
      totalNiches: 15,
      topNiches: [
        {
          name: 'Electronics & Gadgets',
          description: 'Tech enthusiasts and gadget lovers',
          productCount: 1250,
          avgPrice: 89.99,
          growthRate: 0.15,
        },
        {
          name: 'Home & Garden',
          description: 'Home improvement and gardening enthusiasts',
          productCount: 980,
          avgPrice: 45.5,
          growthRate: 0.12,
        },
        {
          name: 'Books & Literature',
          description: 'Book lovers and reading enthusiasts',
          productCount: 750,
          avgPrice: 18.99,
          growthRate: 0.08,
        },
        {
          name: 'Sports & Fitness',
          description: 'Fitness enthusiasts and athletes',
          productCount: 650,
          avgPrice: 65.0,
          growthRate: 0.18,
        },
        {
          name: 'Beauty & Personal Care',
          description: 'Beauty and personal care enthusiasts',
          productCount: 420,
          avgPrice: 32.99,
          growthRate: 0.22,
        },
      ],
    }

    return NextResponse.json({ niches })
  } catch (error) {
    console.error('Error fetching niche insights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch niche insights' },
      { status: 500 }
    )
  }
}
