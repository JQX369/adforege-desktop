// Provider contracts for catalog ingestion. Designed to be minimal, stable, and
// independent of Prisma types to avoid coupling and enable use in scripts.
// Providers should output NormalizedProductInput which the ingestion orchestrator
// will persist using Prisma.
//
// Notes:
// - Keep this file free of runtime dependencies.
// - Extend cautiously; prefer optional fields to avoid breaking providers.

export type ProviderName = 'csv' | 'rainforest' | 'ebay' | (string & {});

export interface ProviderSearchOptions {
  readonly page?: number;
  readonly pageSize?: number;
  // Optional category or filters can be added later without breaking providers.
}

// Raw product shape as returned from a provider before normalization.
export interface ProviderProduct {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly price?: number;
  readonly images?: string[];
  readonly url: string;
  readonly categories?: string[];
  readonly retailer?: string;
  readonly asinOrSourceId?: string; // e.g., Amazon ASIN or provider-specific id
  readonly currency?: string;
}

// Minimal shape used to insert/update our Product model via Prisma in the
// ingestion pipeline. Keep field names aligned with prisma schema where possible.
export interface NormalizedProductInput {
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly images: string[];
  readonly affiliateUrl: string; // canonical outbound URL (tagging happens elsewhere if needed)
  readonly categories: string[];
  readonly retailer?: string;
  readonly asin?: string;
  readonly sourceItemId?: string;
  readonly currency?: string;
  readonly brand?: string;
  readonly urlCanonical?: string;
  // Optional quality/availability hints; pipeline may ignore or recompute
  readonly rating?: number;
  readonly numReviews?: number;
  readonly availability?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
}

export interface CatalogProvider {
  readonly name: ProviderName;
  search(
    query: string,
    options?: ProviderSearchOptions
  ): Promise<ProviderProduct[]>;
  getById(id: string): Promise<ProviderProduct | null>;
  normalize(
    product: ProviderProduct,
    context?: { country?: string; currency?: string }
  ): Promise<NormalizedProductInput>;
}


