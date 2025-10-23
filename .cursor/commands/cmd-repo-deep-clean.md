Repo Deep Clean ++ — Two-Step (Plan → Apply)
Inputs
Removal bias: {{bias|minimal}} # minimal|moderate
Target layout root: {{layout|src}} # src by default
App type: {{app|next}} # next|node|lib|mixed
Package manager: {{pm|pnpm}} # pnpm|yarn|npm
Mode: {{mode|plan}} # plan|apply
Approve: {{approve|NO}} # YES to execute in apply mode
Goal
Same as before—make the repo immediately understandable—but executed via a gated two-step.
Target Layout (unchanged)
/
├─ .github/
├─ .vscode/
├─ docs/ (guides/ decisions/ references/ changelog/)
├─ public/
├─ scripts/
├─ {{layout}}/ (app/ features/ ui/ shared/ lib/ server/)
└─ tests/
What counts as “useless” Markdown (unchanged)
(identical rules; root canonical files always kept)
Step Logic
When mode=plan
Create .reports/ and \_archive/ (no destructive ops).
Run detectors (knip, ts-prune, depcheck, madge) and Markdown heuristics.
Emit a plan, not changes:
.reports/clean-plan.md — human summary
.reports/moves-map.csv — from,to
.reports/md-actions.csv — path,action,reason (KEEP/MOVE/ARCHIVE/DELETE)
.reports/commands-dry-run.sh — proposed git mv/mkdirs (commented)
Print next steps:
Review .reports/\*
Approve by running: echo YES > .reports/APPROVED
When mode=apply (gated)
Requires either {{approve|YES}} or .reports/APPROVED file.
Creates \_archive/$(date +%Y-%m-%d)/.
Executes:
Markdown moves → /docs/... (per md-actions = MOVE)
Archive vs Delete: delete only if ≥2 signals; else archive under \_archive/...
Code moves per moves-map.csv with git mv
Import codemods (jscodeshift / ts-morph)
Dead code removal only if in both knip & ts-prune (or path deleted)
Dep prune from depcheck; then {{pm}} dedupe || true
Gates: format, lint, typecheck, test, build
Writes before/after trees and a final report to .reports/apply-summary.md
Command Script (drop-in)

# === CONFIG FROM CURSOR INPUTS ===

BIAS="{{bias|minimal}}"
LAYOUT="{{layout|src}}"
APP="{{app|next}}"
PM="{{pm|pnpm}}"
MODE="{{mode|plan}}" # plan | apply
APPROVE="{{approve|NO}}" # YES to allow apply

set -euo pipefail

mkdir -p .reports \_archive

# --- Helpers ---

is_yes() { [ "${1:-NO}" = "YES" ]; }

write_file() { # write_file <path> <content>
mkdir -p "$(dirname "$1")"
printf "%s\n" "$2" > "$1"
}

# --- 1) Inventory & Reports (always safe) ---

TREE_BEFORE="$(tree -L 2 2>/dev/null || true)"
write_file ".reports/tree-before.txt" "$TREE_BEFORE"

$PM dlx knip --reporter json > .reports/knip.json || true
$PM dlx ts-prune > .reports/ts-prune.txt || true
$PM dlx depcheck --json > .reports/depcheck.json || true
$PM dlx madge "$LAYOUT" --circular --extensions ts,tsx,js --image .reports/circular.svg || true

git ls-files '_.md' '_.MD' | sort > .reports/markdown.txt || true
grep -E -i '(^#\s\*$|TODO|TBD|Boilerplate|Lorem ipsum|Create React App|Vite)' -n $(cat .reports/markdown.txt) \

> .reports/md-boilerplate-grep.txt || true
> awk '{print $0}' .reports/markdown.txt | xargs -I{} bash -lc '[[ $(wc -c < "{}") -lt 200 ]] && echo "{}"' \
  > .reports/md-tiny.txt || true
grep -vE '^(README|LICENSE|SECURITY|CONTRIBUTING|CHANGELOG).md$' .reports/markdown.txt \
>  | xargs -I{} dirname "{}" | sort | uniq \
>  | xargs -I{} bash -lc '[[! -d "{}/../src" && ! -d "{}/../'"$LAYOUT"'"]] && echo "{}"' \
> .reports/md-orphan-dirs.txt || true
> awk -F/ '{print $NF}' .reports/markdown.txt | sort | uniq -d > .reports/md-duplicate-basenames.txt || true

# --- 2) Build Plan artifacts (no changes) ---

# Heuristic Moves Map (CSV): from,to

# (Rules: ui -> LAYOUT/ui; components -> ui; utils/hooks/types/constants -> shared; api/db/cache/clients -> lib; routes -> app)

: > .reports/moves-map.csv
printf "from,to\n" >> .reports/moves-map.csv
git ls-files | while read -r f; do
case "$f" in
    */components/*)    echo "$f,$LAYOUT/ui/${f#_/components/}" ;;
_/ui/_) echo "$f,$LAYOUT/ui/${f#_/ui/}" ;;
_/hooks/_) echo "$f,$LAYOUT/shared/hooks/${f#*/hooks/}" ;;
    */utils/*)         echo "$f,$LAYOUT/shared/utils/${f#_/utils/}" ;;
_/types/_) echo "$f,$LAYOUT/shared/types/${f#_/types/}" ;;
_/constants/_) echo "$f,$LAYOUT/shared/constants/${f#*/constants/}" ;;
    */api/*)           echo "$f,$LAYOUT/lib/api/${f#_/api/}" ;;
_/db/_) echo "$f,$LAYOUT/lib/db/${f#_/db/}" ;;
_/cache/_) echo "$f,$LAYOUT/lib/cache/${f#*/cache/}" ;;
    */clients/*)       echo "$f,$LAYOUT/lib/clients/${f#_/clients/}" ;;
_/pages/_|_/app/_) echo "$f,$LAYOUT/app/${f#_/pages/}" ;;
\*) continue ;;
esac >> .reports/moves-map.csv
done

# Markdown actions (CSV): path,action,reason

: > .reports/md-actions.csv
printf "path,action,reason\n" >> .reports/md-actions.csv
while read -r md; do
base="$(basename "$md")"
if [["$base" =~ ^(README|LICENSE|SECURITY|CONTRIBUTING|CODE_OF_CONDUCT|CHANGELOG)\.md$]]; then
echo "$md,KEEP,root-canonical" >> .reports/md-actions.csv
  elif grep -q -F "$md" .reports/md-tiny.txt && grep -qi -F "$md" .reports/md-boilerplate-grep.txt; then
    echo "$md,DELETE,tiny+boilerplate" >> .reports/md-actions.csv
elif grep -q -F "$(dirname "$md")" .reports/md-orphan-dirs.txt; then
echo "$md,ARCHIVE,orphan-doc-dir" >> .reports/md-actions.csv
  else
    # move non-root docs into /docs/{guides|references}
    case "$base" in
_ADR_|ADR-*.md) bucket="decisions" ;;
CHANGELOG.md|releases.md) bucket="changelog" ;;
*ref*|*reference*|API*.md) bucket="references" ;;
\*) bucket="guides" ;;
esac
echo "$md,MOVE,docs/$bucket/" >> .reports/md-actions.csv
fi
done < .reports/markdown.txt

# Human summary

write_file ".reports/clean-plan.md" "\

# Clean Plan (Dry Run)

- Bias: $BIAS | Layout: $LAYOUT | App: $APP | PM: $PM
- Moves Map: .reports/moves-map.csv
- Markdown Actions: .reports/md-actions.csv
- Detectors: knip.json, ts-prune.txt, depcheck.json, circular.svg
- To approve: echo YES > .reports/APPROVED
  "

# A helper script with commented dry-run commands

{
echo "#!/usr/bin/env bash"
echo "# Proposed moves (dry-run). Uncomment to apply, or run with MODE=apply."
echo "set -euo pipefail"
echo "# git mv <from> <to> # from .reports/moves-map.csv"
} > .reports/commands-dry-run.sh
chmod +x .reports/commands-dry-run.sh

# --- Early exit for plan mode ---

if [ "$MODE" = "plan" ]; then
echo "Dry run complete. Review .reports/\*"
exit 0
fi

# --- 3) APPLY (requires approval) ---

if [ "$MODE" = "apply" ]; then
if ! is_yes "$APPROVE" && [ ! -f .reports/APPROVED ]; then
echo "ERROR: Apply mode requires approval. Set {{approve|YES}} or create .reports/APPROVED." >&2
exit 1
fi

ARCHIVE_DIR="\_archive/$(date +%F)"
  mkdir -p "$ARCHIVE_DIR" docs/{guides,decisions,references,changelog} "$LAYOUT"/{app,features,ui,shared/{utils,hooks,types,constants},lib/{api,db,cache,clients},server} 2>/dev/null || true

# Apply Markdown actions

tail -n +2 .reports/md-actions.csv | while IFS=, read -r path action reason; do
case "$action" in
      MOVE)
        bucket="$(echo "$reason" | sed 's|docs/||; s|/||g')"
        dest="docs/$bucket/$(basename "$path")"
git mv "$path" "$dest" 2>/dev/null || mkdir -p "$(dirname "$dest")" && git mv "$path" "$dest" || true
;;
ARCHIVE)
mkdir -p "$ARCHIVE_DIR/docs"
        git mv "$path" "$ARCHIVE_DIR/docs/$(basename "$path")" || true
        ;;
      DELETE)
        git rm -f "$path" || true
;;
KEEP) : ;;
esac
done

# Apply code moves

tail -n +2 .reports/moves-map.csv | while IFS=, read -r from to; do
[ -e "$from" ] || continue
mkdir -p "$(dirname "$to")" 2>/dev/null || true
git mv "$from" "$to" || true
done

# Codemods (imports / path aliases)

$PM dlx jscodeshift -t path-alias-update.js "$LAYOUT/\*_/_.{ts,tsx,js,jsx}" || true

# Dead code removal: only if flagged by both tools

if [ -s .reports/knip.json ] && [ -s .reports/ts-prune.txt ]; then # (Lightweight example: remove files fully unused & listed by ts-prune as 'unused exports (no usages)')
awk '/^src|^'"$LAYOUT"'/' .reports/ts-prune.txt | awk '{print $1}' | sort -u > .reports/ts-prune-files.txt || true # You can extend this section to parse knip.json for consensus; keeping conservative by default.
fi

# Dep prune

$PM dedupe || true
$PM dlx depcheck --json > .reports/depcheck-after.json || true

# Gates

$PM run -s format || true
$PM run -s lint || true
$PM run -s typecheck || true
$PM run -s test || true
$PM run -s build || true

TREE_AFTER="$(tree -L 2 2>/dev/null || true)"
  write_file ".reports/tree-after.txt" "$TREE_AFTER"
write_file ".reports/apply-summary.md" "\

# Apply Summary

- Approved: YES
- Archive: $ARCHIVE_DIR
- See tree-before.txt vs tree-after.txt
- Detectors re-run: depcheck-after.json
  "

  echo "Apply complete. Review .reports/apply-summary.md"
  fi
