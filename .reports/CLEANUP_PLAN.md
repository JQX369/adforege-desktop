# Repo Cleanup Plan

- Archived unused demo file: \_archive/2025-10-22/UI example.tsx
- Next candidates to archive (manual review):
  - app/admin/\* dashboards if unused in prod
  - scripts/\* ad-hoc scripts not in CI
  - docs/\* stale notes

- Proposed layout (future PR):
  - src/features, src/ui, src/shared (codemod imports)

- Follow-ups:
  - Upgrade vite to 7.1.11 (moderate advisory)
  - Consider major upgrades (next 16, prisma 6) post-release
