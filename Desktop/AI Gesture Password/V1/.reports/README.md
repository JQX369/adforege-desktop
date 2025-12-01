# Reports Directory

Auto-generated reports from codebase analysis tools.

## Current Reports

| File | Description | Updated |
|------|-------------|---------|
| `repo-inventory.md` | Top-level directory sizes and file counts | 2025-11-22 |
| `repo-tree.txt` | Full directory tree (depth 2) | 2025-11-22 |
| `tree-after.txt` | Tree snapshot after last cleanup | 2025-11-22 |
| `tree-before.txt` | Tree snapshot before last cleanup | 2025-11-22 |
| `knip.json` | Unused exports/files detection | 2025-11-22 |
| `depcheck.json` | Unused npm dependencies | 2025-11-22 |
| `dependencies.json` | Python dependency analysis | 2025-11-22 |

## Archived Reports

Historical reports from previous cleanup operations are stored in `_archive/YYYY-MM-DD/reports/`.

## Regenerating Reports

```bash
# Python dependencies
pip install pipreqs
pipreqs . --savepath .reports/pipreqs.txt

# NPM dependencies
cd src/web && npx depcheck --json > ../../.reports/depcheck.json

# Unused code (TypeScript)
cd src/web && npx knip --reporter json > ../../.reports/knip.json

# Directory tree
tree -L 2 > .reports/repo-tree.txt
```

## Usage

These reports help identify:
- Dead code and unused exports
- Orphaned dependencies
- Repository size distribution
- Cleanup opportunities








