import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/utils'
import { GiftFormData } from '@/lib/prompts/GiftPrompt'
import { buildAffiliateUrl } from '@/lib/affiliates'
import { getRecommendations } from '@/lib/recs'
import { appendSeenIds, buildSessionProfile } from '@/lib/recs/session'
import { logImpressions } from '@/lib/recs/events'
import { resolveGeo } from '@/src/shared/constants/geo'
import { logError } from '@/lib/log'
import {
  getCached,
  cacheKeys,
  CACHE_TTL,
  cache,
} from '@/src/shared/utils/cache'
import { trackApiCall } from '@/src/shared/utils/analytics'
import { rateLimiters } from '@/lib/rate-limit'
import { validateInput, schemas } from '@/lib/validation'
import { withCsrfProtection } from '@/lib/csrf'
import { withErrorHandling, ApiErrorHandler } from '@/lib/api-error-handler'
import { z } from 'zod'

export const POST = withErrorHandling(
  async (request: NextRequest) => {
    const startTime = Date.now()

    try {
      console.log('🔍 [DEBUG] Starting recommendation request')

      // Debug 1: Check environment variables
      console.log('🔍 [DEBUG] Environment check:', {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
        openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) || 'N/A',
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      })

      // Rate limiting
      const rateLimitResult = rateLimiters.recommendations(request)
      if (!rateLimitResult.success) {
        return ApiErrorHandler.rateLimitError(rateLimitResult.retryAfter)
      }

      const body = await request.json()

      // Input validation
      const validationResult = validateInput(
        z.object({
          formData: z.object({
            occasion: schemas.occasion,
            relationship: schemas.relationship,
            gender: schemas.gender,
            ageRange: schemas.ageRange,
            budget: schemas.budget,
            interests: schemas.interests,
          }),
          userId: schemas.userId,
          page: schemas.page,
        }),
        body
      )

      if (!validationResult.success) {
        return ApiErrorHandler.validationError(
          'Invalid input',
          validationResult.errors
        )
      }

      const { formData, userId, page = 0 } = validationResult.data

      // Check cache for recommendations
      const cacheKey = cacheKeys.recommendations(userId || 'anon', formData)
      const cachedResult = getCached(
        cacheKey,
        async () => null,
        CACHE_TTL.MEDIUM
      )

      if (cachedResult) {
        console.log('🔍 [DEBUG] Returning cached recommendations')
        trackApiCall('recommend', Date.now() - startTime, 200)
        return NextResponse.json(cachedResult)
      }

      // Debug 2: Check form data
      console.log('🔍 [DEBUG] Form data received:', {
        occasion: formData.occasion,
        relationship: formData.relationship,
        interests: formData.interests,
        interestsCount: formData.interests?.length || 0,
      })

      const geoInfo = await resolveGeo(request.headers)
      console.log('🔍 [DEBUG] Geo info:', geoInfo)

      const preferenceText = `${formData.occasion} gift for ${formData.relationship} who likes ${(formData.interests || []).join(', ')}`
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      console.log('🔍 [DEBUG] Session details:', {
        sessionId,
        preferenceText: preferenceText.substring(0, 100) + '...',
      })

      const constraints = {
        interests: formData.interests || [],
        occasion: formData.occasion,
        relationship: formData.relationship,
        minPrice: undefined,
        maxPrice: undefined,
        seenIds: [],
        excludeIds: [],
      }

      console.log('🔍 [DEBUG] Building session profile...')
      const sessionProfile = await buildSessionProfile(
        sessionId,
        preferenceText,
        constraints
      )
      console.log('🔍 [DEBUG] Session profile created:', {
        sessionId: sessionProfile.sessionId,
        hasEmbedding: !!sessionProfile.embedding,
        embeddingLength: sessionProfile.embedding?.length || 0,
      })

      // Debug 3: Check database connection and tables
      console.log('🔍 [DEBUG] Getting recommendations...')
      const recs = await getRecommendations({
        session: sessionProfile,
        page,
        pageSize: 30,
        country: geoInfo.country,
        region: geoInfo.country,
      })

      console.log('🔍 [DEBUG] Recommendations received:', {
        productCount: recs.products.length,
        hasMore: recs.hasMore,
        firstProductId: recs.products[0]?.id || 'N/A',
      })

      const recommendations = recs.products.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        imageUrl: product.images?.[0] || '',
        affiliateUrl: buildAffiliateUrl(product.affiliateUrl, geoInfo.country),
        matchScore: product.finalScore,
        categories: product.categories,
        isVendor: Boolean(product.vendorEmail),
        sponsored: Boolean(product.sponsored),
        vendor: product.retailer,
        badges: product.badges,
        currency: product.currency ?? geoInfo.currency,
        deliveryDays: product.deliveryDays,
      }))

      const recommendationIds = recommendations.map((product) => product.id)
      console.log(
        '🔍 [DEBUG] Recommendation IDs:',
        recommendationIds.slice(0, 5)
      )

      // Debug 4: Check database operations
      console.log('🔍 [DEBUG] Saving session data...')
      await Promise.all([
        appendSeenIds(sessionId, recommendationIds),
        logImpressions({ sessionId, userId, productIds: recommendationIds }),
      ])
      console.log('🔍 [DEBUG] Session data saved successfully')

      const result = {
        recommendations,
        sessionId,
        page,
        hasMore: recs.hasMore,
      }

      // Cache the result
      cache.set(cacheKey, result, CACHE_TTL.MEDIUM)

      trackApiCall('recommend', Date.now() - startTime, 200)
      return NextResponse.json(result)
    } catch (error) {
      // Debug 5: Enhanced error logging
      console.error('🔍 [DEBUG] Error details:', {
        errorName: (error as any)?.name,
        errorMessage: (error as any)?.message,
        errorCode: (error as any)?.code,
        errorStack: (error as any)?.stack?.split('\n').slice(0, 5),
        errorType: typeof error,
      })

      logError('Error in recommend API', { error })
      trackApiCall('recommend', Date.now() - startTime, 500)
      throw error // Let the error handler catch it
    }
  },
  { operationName: 'Recommendation API' }
)
