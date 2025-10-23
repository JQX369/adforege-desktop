import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      businessName,
      businessType,
      website,
      description,
      productCategories,
      averagePrice,
      productCount,
      paymentMethod,
      billingAddress,
      taxId,
      communicationPreferences,
      marketingOptIn,
      termsAccepted,
      vendorId,
    } = body

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !businessName ||
      !businessType ||
      !description
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!termsAccepted) {
      return NextResponse.json(
        { error: 'Terms and conditions must be accepted' },
        { status: 400 }
      )
    }

    // Check if vendor exists
    let vendor
    if (vendorId) {
      vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      })
    }

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Update vendor with onboarding data
    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        firstName,
        lastName,
        email,
        phone,
        businessName,
        businessType,
        website,
        description,
        productCategories: productCategories.join(','),
        averagePrice,
        productCount,
        paymentMethod,
        billingAddress,
        taxId,
        communicationPreferences: communicationPreferences.join(','),
        marketingOptIn,
        termsAccepted,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
    })

    // Create onboarding log entry
    await prisma.ingestionLog.create({
      data: {
        type: 'VENDOR_ONBOARDING',
        status: 'COMPLETED',
        message: `Vendor ${businessName} completed onboarding`,
        details: {
          vendorId,
          businessType,
          productCategories,
          averagePrice,
          productCount,
        },
      },
    })

    return NextResponse.json({
      success: true,
      vendor: {
        id: updatedVendor.id,
        businessName: updatedVendor.businessName,
        onboardingCompleted: updatedVendor.onboardingCompleted,
      },
    })
  } catch (error) {
    console.error('Vendor onboarding error:', error)
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}
