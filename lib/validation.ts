import { z } from 'zod'

// Common validation schemas
export const schemas = {
  // User input validation
  email: z.string().email('Invalid email address').max(255),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),

  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters'),

  phone: z
    .string()
    .regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format')
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long'),

  // Product validation
  productId: z.string().uuid('Invalid product ID'),

  productTitle: z
    .string()
    .min(1, 'Product title is required')
    .max(200, 'Product title must be less than 200 characters')
    .regex(
      /^[a-zA-Z0-9\s\-_\.\(\)]+$/,
      'Product title contains invalid characters'
    ),

  productDescription: z
    .string()
    .min(10, 'Product description must be at least 10 characters')
    .max(2000, 'Product description must be less than 2000 characters'),

  price: z
    .number()
    .positive('Price must be positive')
    .max(100000, 'Price too high'),

  // Gift form validation
  occasion: z.enum([
    'birthday',
    'anniversary',
    'holiday',
    'graduation',
    'wedding',
    'baby-shower',
    'housewarming',
    'thank-you',
    'just-because',
    'other',
  ]),

  relationship: z.enum([
    'partner',
    'family',
    'friend',
    'colleague',
    'acquaintance',
    'other',
  ]),

  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']),

  ageRange: z.enum([
    '0-12',
    '13-17',
    '18-24',
    '25-34',
    '35-44',
    '45-54',
    '55-64',
    '65+',
  ]),

  budget: z.enum(['under-25', '25-50', '50-100', '100-200', '200-500', '500+']),

  interests: z.array(z.string()).max(10, 'Too many interests selected'),

  // Vendor validation
  vendorName: z
    .string()
    .min(2, 'Vendor name must be at least 2 characters')
    .max(100, 'Vendor name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_\.&]+$/, 'Vendor name contains invalid characters'),

  vendorWebsite: z
    .string()
    .url('Invalid website URL')
    .max(255, 'Website URL too long'),

  vendorDescription: z
    .string()
    .min(20, 'Vendor description must be at least 20 characters')
    .max(1000, 'Vendor description must be less than 1000 characters'),

  // API validation
  userId: z.string().uuid('Invalid user ID').optional(),

  sessionId: z.string().uuid('Invalid session ID').optional(),

  page: z.number().int().min(0).max(1000).optional(),

  limit: z.number().int().min(1).max(100).optional(),

  // Search validation
  searchQuery: z
    .string()
    .min(1, 'Search query is required')
    .max(100, 'Search query too long')
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Search query contains invalid characters'),

  // File upload validation
  imageFile: z.object({
    name: z.string().max(255),
    size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB'),
    type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  }),
}

// Validation helper functions
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`
        ),
      }
    }
    return {
      success: false,
      errors: ['Validation failed'],
    }
  }
}

// Sanitization functions
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, 1000) // Limit length
}

export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: URLs
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol')
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

// XSS protection
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// SQL injection protection (for dynamic queries)
export function sanitizeSql(input: string): string {
  return input
    .replace(/[';\\]/g, '') // Remove single quotes, semicolons, backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .trim()
}

// CSRF token validation
export function validateCsrfToken(
  token: string,
  sessionToken: string
): boolean {
  if (!token || !sessionToken) return false

  // Use constant-time comparison to prevent timing attacks
  if (token.length !== sessionToken.length) return false

  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ sessionToken.charCodeAt(i)
  }

  return result === 0
}

// Rate limiting validation
export function validateRateLimitKey(key: string): boolean {
  // Ensure rate limit key is safe
  return /^[a-zA-Z0-9:_\-\.]+$/.test(key) && key.length <= 100
}

// File upload validation
export function validateFileUpload(file: File): {
  valid: boolean
  error?: string
} {
  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 5MB' }
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed',
    }
  }

  // Check file name
  if (file.name.length > 255) {
    return { valid: false, error: 'File name too long' }
  }

  // Check for suspicious file names
  const suspiciousPatterns = [/\.(exe|bat|cmd|scr|pif)$/i, /\.(php|asp|jsp)$/i]
  if (suspiciousPatterns.some((pattern) => pattern.test(file.name))) {
    return { valid: false, error: 'Suspicious file type detected' }
  }

  return { valid: true }
}

// Environment variable validation
export function validateEnvVar(
  key: string,
  value: string | undefined
): boolean {
  if (!value) return false

  // Check for minimum length
  if (value.length < 10) return false

  // Check for common patterns
  switch (key) {
    case 'DATABASE_URL':
      return (
        value.startsWith('postgresql://') || value.startsWith('postgres://')
      )
    case 'OPENAI_API_KEY':
      return value.startsWith('sk-')
    case 'EBAY_CLIENT_ID':
      return value.length >= 32
    case 'EBAY_CLIENT_SECRET':
      return value.length >= 32
    case 'RAINFOREST_API_KEY':
      return value.length >= 32
    default:
      return true
  }
}
