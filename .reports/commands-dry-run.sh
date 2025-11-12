#!/usr/bin/env bash
# Proposed moves (dry-run). Uncomment to apply, or run with MODE=apply.
set -euo pipefail

# Markdown moves
# git mv SETUP_GUIDE.md docs/guides/setup-guide.md
# git mv LAUNCH_CHECKLIST.md docs/guides/launch-checklist.md
# git mv API_INGESTION_SUMMARY.md docs/references/api-ingestion-summary.md

# Code moves (example - see moves-map.csv for full list)
# mkdir -p src/ui/components
# git mv components/* src/ui/components/

echo "Dry-run commands generated. Review and uncomment to apply."
