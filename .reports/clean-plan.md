# Repository Deep Clean Plan

## Configuration
- **Bias**: minimal
- **Layout Root**: src
- **App Type**: next
- **Package Manager**: npm

## Analysis Results

### Markdown Files
Found 50 markdown files:
- 42 to KEEP
- 4 to MOVE
- 4 to ARCHIVE
- 0 to DELETE

### File Moves
Proposed 55 file moves:
- Components: 26 files
- Lib files: 29 files
- Prompts: 2 files
- App consolidation: 0 files

## Next Steps

1. **Review Reports**: Check all files in `.reports/`
2. **Review Moves**: Check `.reports/moves-map.csv` for file moves
3. **Review Markdown**: Check `.reports/md-actions.csv` for markdown actions
4. **Approve Changes**: Run `echo YES > .reports/APPROVED`
5. **Apply Changes**: Re-run with `mode=apply approve=YES`

## Files Generated

- `.reports/clean-plan.md` - This summary
- `.reports/moves-map.csv` - Code file moves
- `.reports/md-actions.csv` - Markdown file actions
- `.reports/markdown.txt` - All markdown files found
