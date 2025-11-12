#!/usr/bin/env bash
# Execute file moves from moves-map.csv
set -euo pipefail

cd "/Users/jqx/Desktop/Fairy Wize"

# Read moves-map.csv and execute moves
tail -n +2 .reports/moves-map.csv | while IFS=, read -r from to reason; do
  if [ -f "$from" ]; then
    # Create target directory if it doesn't exist
    mkdir -p "$(dirname "$to")"
    # Move file using git mv if tracked, otherwise mv
    if git ls-files --error-unmatch "$from" >/dev/null 2>&1; then
      git mv "$from" "$to" || mv "$from" "$to"
    else
      mv "$from" "$to"
    fi
    echo "✅ Moved: $from → $to"
  else
    echo "⚠️  Skipped (not found): $from"
  fi
done

echo "File moves completed!"

