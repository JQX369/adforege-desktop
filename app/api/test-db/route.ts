import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Test basic database connection
    const userCount = await prisma.user.count()
    const productCount = await prisma.product.count()
    
    // Test pgvector extension
    const extensionCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as pgvector_enabled
    ` as any[]
    
    return NextResponse.json({
      success: true,
      database: 'connected',
      userCount,
      productCount,
      pgvectorEnabled: extensionCheck[0]?.pgvector_enabled || false,
      message: 'Database connection successful!'
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 