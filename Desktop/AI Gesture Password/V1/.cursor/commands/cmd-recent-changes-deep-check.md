# Recent Changes Deep Check

## Goal

Exhaustively analyze recent changes (types, runtime, tests, lint, deps, circularity, size, secrets) and return a single actionable report with a pass/fail gate.

## Inputs

- Diff range or recency: {{range|origin/main..HEAD}} # e.g., origin/main..HEAD OR --since="7 days ago"
- Package manager: {{pm|pnpm}} # pnpm|yarn|npm
- Test runner: {{test|vitest}} # vitest|jest|none
- App type: {{app|next}} # next|node|lib|mixed

## Steps (Planner)

1. **Collect diffs**
   - Files: `git diff --name-status {{range}}`
   - Stats: `git diff --stat {{range}}`
   - Authors & churn: `git shortlog -sne {{range}}`
2. **Map impact**
   - Group by pkg/workspace and module.
   - Identify touched exports & dependents (TS project references if present).
3. **Focused checks (changed files only)**
   - Typecheck: `{{pm}} run -s typecheck -- --pretty false --noEmit`
   - Lint: `{{pm}} run -s lint -- --max-warnings=0`
   - Test (touched):
     - vitest: `{{pm}} vitest related --run $(git diff --name-only {{range}} | tr '\n' ' ')`
     - jest: `{{pm}} jest -o --findRelatedTests $(git diff --name-only {{range}})`
4. **Structural health**
   - Circular deps (madge): `npx madge --circular --extensions ts,tsx,js src`
   - Unused exports (knip/ts-prune):
     - `npx knip --changed $(git diff --name-only {{range}} | tr '\n' ' ')`
     - or `npx ts-prune`
   - Unused deps (depcheck): `npx depcheck`
   - Bundle/route size (if Next): `{{pm}} run -s build` then analyze `.next` output
5. **Security/Safety**
   - Secrets: `npx gitleaks detect --no-git -v`
   - Audit: `{{pm}} audit` (or `pnpm audit --recursive`)
6. **DX**
   - Prettier check: `{{pm}} run -s format:check`
   - Outdated: `{{pm}} outdated || true`
7. **Report**
   - Summarize FAIL/OK per check with file lists and minimal diffs.
   - Risk register: Top 10 issues, blast radius, fix plan.
   - Auto-generate next commands (copy/paste).

## Output Format

- **Summary** (green/red badges) for: typecheck, lint, tests, circular, unused-exports, unused-deps, size, secrets, audit, prettier, outdated.
- **Impact Matrix**: changed file → affected modules → routes/binaries.
- **Action Plan**: 3–7 steps, each ≤15 minutes, ordered by risk reduction.
- **Copy/Paste Block**: commands to fix & re-run gates.

## Heuristics

- Prefer narrow adapters over wide refactors.
- If tests are absent, add 1 golden test around the changed surface.
- Break the “reds” with the smallest uniform fix (e.g., shared type guard).

## Run Hints (paste as needed)

- Changed files: `git diff --name-only {{range}}`
- All checks (full repo): `{{pm}} run -s typecheck && {{pm}} run -s lint && {{pm}} run -s test`
- Install helpers: `{{pm}} dlx madge knip depcheck gitleaks`
