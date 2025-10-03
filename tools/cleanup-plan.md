# Cleanup Step 1 – Legacy Removal Checklist

## Targeted Modules & Scripts

- `lib/providers/rainforest.ts` – superseded by `rainforest-enhanced.ts`
- `lib/providers/ebay.ts` – superseded by `ebay-enhanced.ts`
- Perplexity-based scripts: `scripts/simple-ingest-test.js`, `scripts/simple-rainforest-ingest.js`, `scripts/test-ebay*.js`, `scripts/test-rainforest.js`
- Deprecated recommendation helpers: `RecommendLog`, `ClickEvent` usage in API routes

## Actions

1. Remove unused providers and update imports throughout the codebase
2. Delete legacy ingestion/testing scripts and references in `package.json`
3. Replace `RecommendLog` and manual click tracking with modern `RecommendationEvent` logging
4. Update documentation references to point to new scripts (`npm run enrich`, `npm run recs:lint`)
5. Add automated lint/test covers for new modules only

## Safeguards

- Verify no imports remain before deleting files (`rg 'providers/rainforest'` etc.)
- Keep new modules untouched; only remove legacy code
- Run `npm run lint` after removal


