import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const vendorId = formData.get('vendorId') as string

    if (!file || !vendorId) {
      return NextResponse.json(
        { error: 'File and vendor ID are required' },
        { status: 400 }
      )
    }

    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Parse CSV file
    const csvText = await file.text()
    const lines = csvText.split('\n').filter((line) => line.trim())

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must have at least a header and one data row' },
        { status: 400 }
      )
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const requiredHeaders = [
      'title',
      'description',
      'price',
      'currency',
      'category',
    ]

    // Validate headers
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required headers: ${missingHeaders.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const products = []
    const errors = []

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]
        .split(',')
        .map((cell) => cell.trim().replace(/^"|"$/g, ''))

      if (row.length !== headers.length) {
        errors.push(`Row ${i + 1}: Column count mismatch`)
        continue
      }

      const productData: any = {}
      headers.forEach((header, index) => {
        productData[header] = row[index]
      })

      // Validate required fields
      if (
        !productData.title ||
        !productData.description ||
        !productData.price ||
        !productData.currency ||
        !productData.category
      ) {
        errors.push(`Row ${i + 1}: Missing required fields`)
        continue
      }

      // Validate price
      const price = parseFloat(productData.price)
      if (isNaN(price) || price <= 0) {
        errors.push(`Row ${i + 1}: Invalid price`)
        continue
      }

      // Validate currency
      const validCurrencies = ['USD', 'GBP', 'EUR']
      if (!validCurrencies.includes(productData.currency.toUpperCase())) {
        errors.push(`Row ${i + 1}: Invalid currency`)
        continue
      }

      // Prepare product for database
      const product = {
        title: productData.title,
        description: productData.description,
        price: price,
        currency: productData.currency.toUpperCase(),
        category: productData.category,
        tags: productData.tags
          ? productData.tags.split(',').map((tag: string) => tag.trim())
          : [],
        images: productData.imageurl ? [productData.imageurl] : [],
        affiliateUrl: productData.affiliateurl || '',
        vendorId: vendorId,
        status: 'PENDING' as const,
      }

      products.push(product)
    }

    if (products.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid products found',
          errors,
        },
        { status: 400 }
      )
    }

    // Insert products into database
    const createdProducts = await prisma.product.createMany({
      data: products,
    })

    return NextResponse.json({
      success: true,
      count: createdProducts.count,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk upload' },
      { status: 500 }
    )
  }
}
