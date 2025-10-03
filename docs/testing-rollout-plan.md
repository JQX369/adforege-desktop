# Testing & Rollout Enhancements

## Goals
- Establish integration / E2E coverage for recommendation flows
- Introduce rate-limit & budget guardrails
- Provide feature flags for gradual rollout
- Document monitoring & alerting

## Tasks
1. **Automated Tests**
   - Vitest unit tests for `lib/recs/*`
   - API route integration tests (`/api/recommend`, `/api/vendor/stats`, `/api/admin/curation`)
   - Playwright end-to-end: landing ➝ recs ➝ swipe/save ➝ vendor dashboard login
2. **Guardrails**
   - Add reroll rate limiting (per session/hour)
   - Track LLM usage counts; trigger Sentry/Slack when thresholds exceeded
   - Add health endpoint for availability/enrichment tasks
3. **Feature Flags & Rollout**
   - Environment-driven toggles: `RECS_LLM_RERANK_ENABLED`, `RECS_CURATED_BOOSTS_ENABLED`
   - Implement staged rollout (internal ➝ beta ➝ production) with `NEXT_PUBLIC_FEATURE_*`
4. **Monitoring/Alerting**
   - Instrument logs with request IDs, session IDs, timing
   - Add Sentry or logging pipeline for errors
   - Create ops runbook summarizing cron schedules (`/api/refresh/availability`, `npm run enrich`)

## Deliverables
- Test suites in `/tests`
- Guardrail code + env configuration
- Updated README/runbooks
