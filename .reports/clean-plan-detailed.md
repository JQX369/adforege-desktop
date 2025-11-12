# Repository Deep Clean Plan - Detailed Analysis

## Configuration
- **Bias**: minimal
- **Layout Root**: src
- **App Type**: next
- **Package Manager**: npm

## Summary

### Proposed Changes
- **55 file moves** to consolidate structure
- **4 markdown files** to organize into docs/
- **4 tiny files** to archive

### Impact Analysis

#### File Moves
1. **Components** (26 files) → `src/ui/components/`
   - All files in `components/` will be moved
   - **BREAKING**: All imports using `@/components/...` will need updating
   - Estimated import updates needed: ~20+ files

2. **Lib Files** (29 files) → `src/lib/`
   - Files from root `lib/` will be consolidated with existing `src/lib/`
   - Some files may already exist in `src/lib/` (will need merge strategy)
   - **BREAKING**: Import paths may need updating

3. **Prompts** (2 files) → `src/lib/prompts/`
   - Simple move, should be safe

#### Markdown Organization
- 4 files to move to `docs/guides/` or `docs/references/`
- 4 tiny files to archive (already in `_archive/`)

## Risks & Considerations

1. **Import Path Updates Required**
   - Current imports use `@/components/...` which resolves to `components/`
   - After move, will need to update to `@/components/...` → `src/ui/components/`
   - OR update tsconfig.json path mappings

2. **Potential Conflicts**
   - Some files may already exist in target locations
   - Need to check for duplicates before moving

3. **Test Files**
   - Test files import from `@/components/` - will need updates

## Recommended Approach

### Option 1: Update tsconfig.json (Recommended)
Update path mappings so `@/components` points to new location:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["src/ui/components/*"],
      "@/lib/*": ["src/lib/*"]
    }
  }
}
```

### Option 2: Update All Imports
Update all import statements to use new paths (more work, but explicit)

## Next Steps

1. ✅ **Plan Generated** - Review `.reports/moves-map.csv` and `.reports/md-actions.csv`
2. ⏳ **Check Conflicts** - Verify no file conflicts exist
3. ⏳ **Update Path Mappings** - Modify tsconfig.json if using Option 1
4. ⏳ **Approve Changes** - Run `echo YES > .reports/APPROVED`
5. ⏳ **Apply Changes** - Execute moves with import updates

## Files to Review

- `.reports/moves-map.csv` - All proposed file moves
- `.reports/md-actions.csv` - Markdown file actions
- `tsconfig.json` - Current path mappings

