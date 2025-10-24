import { organizationSchema, websiteSchema } from '@/lib/schema'

export function SeoStructuredData() {
  const payload = [websiteSchema, organizationSchema]
  return payload.map((schema, index) => (
    <script
      key={index}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  ))
}
