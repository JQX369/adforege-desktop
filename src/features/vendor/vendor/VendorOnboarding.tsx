'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/ui/card'
import { Button } from '@/src/ui/button'
import { Input } from '@/src/ui/input'
import { Label } from '@/src/ui/label'
import { Textarea } from '@/src/ui/textarea'
import { Progress } from '@/src/ui/progress'
import { Alert, AlertDescription } from '@/src/ui/alert'
import { Checkbox } from '@/src/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/ui/select'
import {
  CheckCircle,
  Circle,
  ArrowRight,
  ArrowLeft,
  User,
  Building,
  Package,
  Settings,
  CreditCard,
  FileText,
  Upload,
  Link,
  Target,
  TrendingUp,
} from 'lucide-react'

interface VendorOnboardingProps {
  vendorId?: string
  onComplete?: () => void
}

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  required: boolean
}

interface OnboardingData {
  // Personal Information
  firstName: string
  lastName: string
  email: string
  phone: string

  // Business Information
  businessName: string
  businessType: string
  website: string
  description: string

  // Product Information
  productCategories: string[]
  averagePrice: string
  productCount: string

  // Payment Information
  paymentMethod: string
  billingAddress: string
  taxId: string

  // Preferences
  communicationPreferences: string[]
  marketingOptIn: boolean
  termsAccepted: boolean
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Tell us about yourself',
    icon: <User className="h-5 w-5" />,
    required: true,
  },
  {
    id: 'business',
    title: 'Business Information',
    description: 'Share your business details',
    icon: <Building className="h-5 w-5" />,
    required: true,
  },
  {
    id: 'products',
    title: 'Product Information',
    description: 'Describe your products',
    icon: <Package className="h-5 w-5" />,
    required: true,
  },
  {
    id: 'payment',
    title: 'Payment Setup',
    description: 'Configure payment methods',
    icon: <CreditCard className="h-5 w-5" />,
    required: true,
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Set your preferences',
    icon: <Settings className="h-5 w-5" />,
    required: false,
  },
]

export function VendorOnboarding({
  vendorId,
  onComplete,
}: VendorOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    businessName: '',
    businessType: '',
    website: '',
    description: '',
    productCategories: [],
    averagePrice: '',
    productCount: '',
    paymentMethod: '',
    billingAddress: '',
    taxId: '',
    communicationPreferences: [],
    marketingOptIn: false,
    termsAccepted: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const progress = ((currentStep + 1) / onboardingSteps.length) * 100

  const validateStep = (stepId: string): boolean => {
    const newErrors: Record<string, string> = {}

    switch (stepId) {
      case 'personal':
        if (!data.firstName.trim())
          newErrors.firstName = 'First name is required'
        if (!data.lastName.trim()) newErrors.lastName = 'Last name is required'
        if (!data.email.trim()) newErrors.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(data.email))
          newErrors.email = 'Email is invalid'
        break

      case 'business':
        if (!data.businessName.trim())
          newErrors.businessName = 'Business name is required'
        if (!data.businessType)
          newErrors.businessType = 'Business type is required'
        if (!data.description.trim())
          newErrors.description = 'Business description is required'
        break

      case 'products':
        if (data.productCategories.length === 0)
          newErrors.productCategories = 'At least one category is required'
        if (!data.averagePrice)
          newErrors.averagePrice = 'Average price is required'
        if (!data.productCount)
          newErrors.productCount = 'Product count is required'
        break

      case 'payment':
        if (!data.paymentMethod)
          newErrors.paymentMethod = 'Payment method is required'
        if (!data.billingAddress.trim())
          newErrors.billingAddress = 'Billing address is required'
        break

      case 'preferences':
        if (!data.termsAccepted)
          newErrors.termsAccepted = 'You must accept the terms and conditions'
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    const currentStepData = onboardingSteps[currentStep]
    if (validateStep(currentStepData.id)) {
      if (currentStep < onboardingSteps.length - 1) {
        setCurrentStep(currentStep + 1)
      } else {
        handleSubmit()
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/vendor/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, vendorId }),
      })

      if (response.ok) {
        onComplete?.()
      } else {
        const error = await response.json()
        setErrors({ submit: error.message || 'Submission failed' })
      }
    } catch (error) {
      setErrors({ submit: 'Network error occurred' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }

  const renderStepContent = () => {
    const step = onboardingSteps[currentStep]

    switch (step.id) {
      case 'personal':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={data.firstName}
                  onChange={(e) => updateData({ firstName: e.target.value })}
                  className={errors.firstName ? 'border-red-500' : ''}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={data.lastName}
                  onChange={(e) => updateData({ lastName: e.target.value })}
                  className={errors.lastName ? 'border-red-500' : ''}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-500">{errors.lastName}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => updateData({ email: e.target.value })}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={data.phone}
                onChange={(e) => updateData({ phone: e.target.value })}
              />
            </div>
          </div>
        )

      case 'business':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={data.businessName}
                onChange={(e) => updateData({ businessName: e.target.value })}
                className={errors.businessName ? 'border-red-500' : ''}
              />
              {errors.businessName && (
                <p className="text-sm text-red-500">{errors.businessName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type *</Label>
              <Select
                value={data.businessType}
                onValueChange={(value) => updateData({ businessType: value })}
              >
                <SelectTrigger
                  className={errors.businessType ? 'border-red-500' : ''}
                >
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual Seller</SelectItem>
                  <SelectItem value="small-business">Small Business</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="nonprofit">Non-profit</SelectItem>
                </SelectContent>
              </Select>
              {errors.businessType && (
                <p className="text-sm text-red-500">{errors.businessType}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://yourwebsite.com"
                value={data.website}
                onChange={(e) => updateData({ website: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Business Description *</Label>
              <Textarea
                id="description"
                placeholder="Tell us about your business..."
                value={data.description}
                onChange={(e) => updateData({ description: e.target.value })}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
            </div>
          </div>
        )

      case 'products':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product Categories *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  'Electronics',
                  'Books',
                  'Clothing',
                  'Home & Garden',
                  'Sports',
                  'Toys',
                  'Beauty',
                  'Health',
                  'Automotive',
                ].map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={category}
                      checked={data.productCategories.includes(category)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateData({
                            productCategories: [
                              ...data.productCategories,
                              category,
                            ],
                          })
                        } else {
                          updateData({
                            productCategories: data.productCategories.filter(
                              (c) => c !== category
                            ),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={category} className="text-sm">
                      {category}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.productCategories && (
                <p className="text-sm text-red-500">
                  {errors.productCategories}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="averagePrice">Average Product Price *</Label>
                <Select
                  value={data.averagePrice}
                  onValueChange={(value) => updateData({ averagePrice: value })}
                >
                  <SelectTrigger
                    className={errors.averagePrice ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Select price range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under-10">Under $10</SelectItem>
                    <SelectItem value="10-25">$10 - $25</SelectItem>
                    <SelectItem value="25-50">$25 - $50</SelectItem>
                    <SelectItem value="50-100">$50 - $100</SelectItem>
                    <SelectItem value="100-500">$100 - $500</SelectItem>
                    <SelectItem value="over-500">Over $500</SelectItem>
                  </SelectContent>
                </Select>
                {errors.averagePrice && (
                  <p className="text-sm text-red-500">{errors.averagePrice}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="productCount">Number of Products *</Label>
                <Select
                  value={data.productCount}
                  onValueChange={(value) => updateData({ productCount: value })}
                >
                  <SelectTrigger
                    className={errors.productCount ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Select product count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-5">1 - 5 products</SelectItem>
                    <SelectItem value="6-20">6 - 20 products</SelectItem>
                    <SelectItem value="21-50">21 - 50 products</SelectItem>
                    <SelectItem value="51-100">51 - 100 products</SelectItem>
                    <SelectItem value="over-100">Over 100 products</SelectItem>
                  </SelectContent>
                </Select>
                {errors.productCount && (
                  <p className="text-sm text-red-500">{errors.productCount}</p>
                )}
              </div>
            </div>
          </div>
        )

      case 'payment':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Preferred Payment Method *</Label>
              <Select
                value={data.paymentMethod}
                onValueChange={(value) => updateData({ paymentMethod: value })}
              >
                <SelectTrigger
                  className={errors.paymentMethod ? 'border-red-500' : ''}
                >
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe (Credit Card)</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
              {errors.paymentMethod && (
                <p className="text-sm text-red-500">{errors.paymentMethod}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingAddress">Billing Address *</Label>
              <Textarea
                id="billingAddress"
                placeholder="Enter your billing address..."
                value={data.billingAddress}
                onChange={(e) => updateData({ billingAddress: e.target.value })}
                className={errors.billingAddress ? 'border-red-500' : ''}
              />
              {errors.billingAddress && (
                <p className="text-sm text-red-500">{errors.billingAddress}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID (Optional)</Label>
              <Input
                id="taxId"
                placeholder="Enter your tax ID if applicable"
                value={data.taxId}
                onChange={(e) => updateData({ taxId: e.target.value })}
              />
            </div>
          </div>
        )

      case 'preferences':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Communication Preferences</Label>
              <div className="space-y-2">
                {[
                  'Email notifications',
                  'SMS alerts',
                  'Weekly reports',
                  'Product recommendations',
                ].map((preference) => (
                  <div key={preference} className="flex items-center space-x-2">
                    <Checkbox
                      id={preference}
                      checked={data.communicationPreferences.includes(
                        preference
                      )}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateData({
                            communicationPreferences: [
                              ...data.communicationPreferences,
                              preference,
                            ],
                          })
                        } else {
                          updateData({
                            communicationPreferences:
                              data.communicationPreferences.filter(
                                (p) => p !== preference
                              ),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={preference} className="text-sm">
                      {preference}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marketing"
                  checked={data.marketingOptIn}
                  onCheckedChange={(checked) =>
                    updateData({ marketingOptIn: !!checked })
                  }
                />
                <Label htmlFor="marketing" className="text-sm">
                  I agree to receive marketing communications from FairyWize
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={data.termsAccepted}
                  onCheckedChange={(checked) =>
                    updateData({ termsAccepted: !!checked })
                  }
                />
                <Label htmlFor="terms" className="text-sm">
                  I accept the{' '}
                  <a href="/terms" className="text-blue-600 hover:underline">
                    Terms and Conditions
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>{' '}
                  *
                </Label>
              </div>
              {errors.termsAccepted && (
                <p className="text-sm text-red-500">{errors.termsAccepted}</p>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome to FairyWize</h1>
        <p className="text-muted-foreground">
          Let's get your vendor account set up
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>
                Step {currentStep + 1} of {onboardingSteps.length}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="w-full" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {onboardingSteps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  {index <= currentStep ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Step */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {onboardingSteps[currentStep].icon}
            {onboardingSteps[currentStep].title}
          </CardTitle>
          <CardDescription>
            {onboardingSteps[currentStep].description}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Error Alert */}
      {errors.submit && (
        <Alert variant="destructive">
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <Button onClick={handleNext} disabled={isSubmitting}>
          {isSubmitting ? (
            'Processing...'
          ) : currentStep === onboardingSteps.length - 1 ? (
            'Complete Setup'
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
