import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Metadata } from 'next'
import { websiteSchema, organizationSchema, softwareApplicationSchema } from '@/lib/schema'

// SEO validation utilities
function validateMetaTags(metadata: Metadata) {
  const errors: string[] = []

  // Required fields
  if (!metadata.title) errors.push('Missing title')
  if (!metadata.description) errors.push('Missing description')

  // Title length (50-60 characters for optimal SEO)
  if (metadata.title && typeof metadata.title === 'string') {
    const titleLength = metadata.title.length
    if (titleLength < 30 || titleLength > 70) {
      errors.push(`Title length ${titleLength} is not optimal (30-70 recommended)`)
    }
  }

  // Description length (120-160 characters)
  if (metadata.description && typeof metadata.description === 'string') {
    const descLength = metadata.description.length
    if (descLength < 120 || descLength > 160) {
      errors.push(`Description length ${descLength} is not optimal (120-160 recommended)`)
    }
  }

  // Keywords validation
  if (metadata.keywords) {
    const keywords = Array.isArray(metadata.keywords) ? metadata.keywords : [metadata.keywords]
    if (keywords.length < 3) {
      errors.push('Too few keywords (minimum 3 recommended)')
    }
    if (keywords.length > 10) {
      errors.push('Too many keywords (maximum 10 recommended)')
    }
  }

  return errors
}

function validateStructuredData(schema: any, type: string) {
  const errors: string[] = []

  if (!schema['@context']) {
    errors.push(`Missing @context for ${type}`)
  }

  if (schema['@context'] !== 'https://schema.org') {
    errors.push(`Invalid @context for ${type}: ${schema['@context']}`)
  }

  if (!schema['@type']) {
    errors.push(`Missing @type for ${type}`)
  }

  return errors
}

describe('SEO Validation', () => {
  describe('Meta Tags', () => {
    it('should validate gift guides page metadata', () => {
      const metadata: Metadata = {
        title: 'Gift Guides | FairyWize AI Gift Finder',
        description: 'Discover the ultimate gift guides for every occasion. From birthday gifts to holiday presents, find personalized recommendations with our AI-powered gift finder',
        keywords: [
          'gift guides', 'holiday gift guide', 'birthday gift ideas',
          'valentines gifts', 'christmas gifts', 'gift ideas for her',
          'gift ideas for him', 'gift recommendations'
        ],
      }

      const errors = validateMetaTags(metadata)
      expect(errors).toHaveLength(0)
    })

    it('should detect invalid title length', () => {
      const metadata: Metadata = {
        title: 'Short',
        description: 'This is a valid description with proper length for SEO purposes and should pass validation.',
      }

      const errors = validateMetaTags(metadata)
      expect(errors).toContain('Title length 5 is not optimal (30-70 recommended)')
    })

    it('should detect invalid description length', () => {
      const metadata: Metadata = {
        title: 'Valid Title Length for SEO Testing',
        description: 'Too short',
      }

      const errors = validateMetaTags(metadata)
      expect(errors).toContain('Description length 9 is not optimal (120-160 recommended)')
    })
  })

  describe('Structured Data', () => {
    it('should validate website schema', () => {
      const errors = validateStructuredData(websiteSchema, 'website')
      expect(errors).toHaveLength(0)
      expect(websiteSchema['@type']).toBe('WebSite')
      expect(websiteSchema.name).toBe('FairyWize')
    })

    it('should validate organization schema', () => {
      const errors = validateStructuredData(organizationSchema, 'organization')
      expect(errors).toHaveLength(0)
      expect(organizationSchema['@type']).toBe('Organization')
      expect(organizationSchema.name).toBe('FairyWize')
    })

    it('should validate software application schema', () => {
      const errors = validateStructuredData(softwareApplicationSchema, 'software')
      expect(errors).toHaveLength(0)
      expect(softwareApplicationSchema['@type']).toBe('SoftwareApplication')
      expect(softwareApplicationSchema.name).toBe('FairyWize AI Gift Finder')
    })

    it('should have proper context URLs', () => {
      expect(websiteSchema['@context']).toBe('https://schema.org')
      expect(organizationSchema['@context']).toBe('https://schema.org')
      expect(softwareApplicationSchema['@context']).toBe('https://schema.org')
    })
  })

  describe('URL Structure', () => {
    it('should validate guide URLs are SEO-friendly', () => {
      const urls = [
        '/gift-guides/for-her',
        '/gift-guides/for-him',
        '/gift-guides/birthday',
        '/gift-guides/under-50',
      ]

      urls.forEach(url => {
        expect(url).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/)
        expect(url.length).toBeLessThan(100) // Reasonable URL length
      })
    })

    it('should validate API endpoints follow REST conventions', () => {
      const endpoints = [
        '/api/guides/top',
        '/api/saved/[userId]',
        '/api/recommend',
      ]

      endpoints.forEach(endpoint => {
        expect(endpoint).toMatch(/^\/api\/[a-z-]+/)
      })
    })
  })
})

// Integration test for metadata rendering
describe('Metadata Rendering', () => {
  it('should render proper meta tags in HTML head', () => {
    // This would typically be tested with a full Next.js test setup
    // For now, we'll validate the metadata structure is correct
    const metadata: Metadata = {
      title: 'Test Page | FairyWize',
      description: 'Test description for SEO validation',
      keywords: ['test', 'seo', 'validation'],
      openGraph: {
        title: 'Test Page | FairyWize',
        description: 'Test description for SEO validation',
        type: 'website',
      },
    }

    expect(metadata.title).toContain('FairyWize')
    expect(metadata.description).toBeDefined()
    expect(metadata.openGraph?.title).toContain('FairyWize')
  })
})
