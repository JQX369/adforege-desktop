# Repository Deep Clean - Execution Plan

## Analysis Complete ✅

### Files Proposed for Move: 55
- Components: 26 files → `src/ui/components/`
- Lib: 29 files → `src/lib/`
- Prompts: 2 files → `src/lib/prompts/`

### Markdown Files: 4 to organize
- SETUP_GUIDE.md → `docs/guides/`
- LAUNCH_CHECKLIST.md → `docs/guides/`
- BUILD_COMPLETE.md → `docs/guides/`
- API_INGESTION_SUMMARY.md → `docs/references/`

### Impact Assessment
- **199 imports** will be affected by component/lib moves
- **Solution**: Update `tsconfig.json` path mappings (simpler than updating all imports)

## Action Plan

### Step 1: Update TypeScript Config ✅
Update `tsconfig.json` to support both old and new paths:
```json
{
  "paths": {
    "@/*": ["./*"],
    "@/components/*": ["src/ui/components/*"],
    "@/lib/*": ["src/lib/*"]
  }
}
```

### Step 2: Check for Conflicts
Verify no duplicate files exist in target locations.

### Step 3: Execute Moves
1. Move components → `src/ui/components/`
2. Move lib files → `src/lib/` (merge if duplicates)
3. Move prompts → `src/lib/prompts/`
4. Organize markdown files

### Step 4: Verify & Test
- Run `npm run typecheck`
- Run `npm run test`
- Run `npm run build`
- Fix any broken imports

## Approval Required

To proceed with apply mode:
1. Review `.reports/moves-map.csv` for all file moves
2. Review `.reports/md-actions.csv` for markdown actions
3. Approve by running: `echo YES > .reports/APPROVED`

Then run: `mode=apply approve=YES` to execute changes.

