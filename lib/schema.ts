// Schema.org structured data for SEO
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "FairyWize",
  "alternateName": "FairyWize AI Gift Finder",
  "url": "https://fairywize.com",
  "description": "AI-powered gift recommendation platform that helps users find perfect presents through personalized suggestions",
  "publisher": {
    "@type": "Organization",
    "name": "FairyWize",
    "url": "https://fairywize.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://fairywize.com/logo.png",
      "width": 512,
      "height": 512
    }
  },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://fairywize.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "FairyWize",
  "url": "https://fairywize.com",
  "logo": "https://fairywize.com/logo.png",
  "description": "AI-powered gift finder helping users discover perfect presents",
  "foundingDate": "2024",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-555-123-4567",
    "contactType": "customer service",
    "email": "support@fairywize.com"
  },
  "sameAs": [
    "https://twitter.com/FairyWize",
    "https://www.instagram.com/FairyWize",
    "https://www.facebook.com/FairyWize"
  ]
}

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FairyWize AI Gift Finder",
  "description": "AI-powered platform for personalized gift recommendations",
  "url": "https://fairywize.com",
  "applicationCategory": "LifestyleApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "featureList": [
    "AI-powered gift recommendations",
    "Personalized gift suggestions",
    "Vendor marketplace integration",
    "Gift guide content"
  ]
}

export const giftGuideSchema = (guideName: string, description: string, url: string) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": guideName,
  "description": description,
  "url": url,
  "publisher": {
    "@type": "Organization",
    "name": "FairyWize",
    "logo": {
      "@type": "ImageObject",
      "url": "https://fairywize.com/logo.png"
    }
  },
  "datePublished": "2024-10-03",
  "dateModified": "2024-10-03",
  "author": {
    "@type": "Organization",
    "name": "FairyWize Team"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": url
  }
})

export const faqSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
})

export const breadcrumbSchema = (breadcrumbs: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": breadcrumbs.map((crumb, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": crumb.name,
    "item": crumb.url
  }))
})

// Product schema for individual gift recommendations
export const productSchema = (product: {
  name: string;
  description: string;
  image: string;
  url: string;
  price: number;
  currency: string;
  availability: string;
  brand?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  "name": product.name,
  "description": product.description,
  "image": product.image,
  "url": product.url,
  "offers": {
    "@type": "Offer",
    "price": product.price,
    "priceCurrency": product.currency,
    "availability": `https://schema.org/${product.availability}`,
    "seller": {
      "@type": "Organization",
      "name": "FairyWize"
    }
  },
  ...(product.brand && {
    "brand": {
      "@type": "Brand",
      "name": product.brand
    }
  })
})

// Local business schema for local gift shops
export const localBusinessSchema = (business: {
  name: string;
  description: string;
  address: string;
  phone?: string;
  url?: string;
  image?: string;
  priceRange?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": business.name,
  "description": business.description,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": business.address
  },
  ...(business.phone && { "telephone": business.phone }),
  ...(business.url && { "url": business.url }),
  ...(business.image && { "image": business.image }),
  ...(business.priceRange && { "priceRange": business.priceRange }),
  "paymentAccepted": "Cash, Credit Card",
  "currenciesAccepted": "USD"
})
