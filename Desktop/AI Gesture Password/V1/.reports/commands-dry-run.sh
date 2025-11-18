#!/usr/bin/env bash
# Proposed moves (dry-run). Uncomment git mv commands to execute manually or rerun automation in apply mode.
set -euo pipefail

# Markdown moves/actions preview
while IFS=, read -r path action reason; do
  if [[ "$path" == "path" ]]; then
    continue
  fi
  case "$action" in
    MOVE)
      echo "# git mv \"$path\" \"${reason%/}/$(basename \"$path\")\""
      ;;
    ARCHIVE)
      echo "# git mv \"$path\" \"_archive/$(date +%F)/docs/$(basename \"$path\")\""
      ;;
    DELETE)
      echo "# git rm -f \"$path\""
      ;;
    *) ;;
  esac
done < .reports/md-actions.csv

echo "# Code moves"
while IFS=, read -r from to; do
  if [[ "$from" == "from" ]]; then
    continue
  fi
  echo "# git mv \"$from\" \"$to\""
done < .reports/moves-map.csv
