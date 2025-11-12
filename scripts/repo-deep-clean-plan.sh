#!/usr/bin/env bash
# Repo Deep Clean - Plan Mode
# Generates reports without making changes

set -euo pipefail

BIAS="${1:-minimal}"
LAYOUT="${2:-src}"
APP="${3:-next}"
PM="${4:-npm}"
MODE="${5:-plan}"

echo "🔍 Running deep clean analysis..."
echo "  Bias: $BIAS | Layout: $LAYOUT | App: $APP | PM: $PM | Mode: $MODE"

mkdir -p .reports _archive

# Helper function
write_file() {
  mkdir -p "$(dirname "$1")"
  printf "%s\n" "$2" > "$1"
}

# 1. Capture current tree structure
echo "📊 Capturing current structure..."
if command -v tree >/dev/null 2>&1; then
  tree -L 3 -I 'node_modules|.next|.git|coverage' > .reports/tree-before.txt 2>/dev/null || true
else
  find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' | sort > .reports/tree-before.txt || true
fi

# 2. Analyze markdown files
echo "📝 Analyzing markdown files..."
cat > .reports/markdown.txt << 'EOF'
README.md
SETUP_GUIDE.md
LAUNCH_CHECKLIST.md
BUILD_COMPLETE.md
API_INGESTION_SUMMARY.md
docs/LAUNCH_PLANS.md
docs/guides/VENDOR_PRICING.md
docs/references/DESIGN_VISION_FOR_AI.md
EOF

# 3. Generate moves map for code organization
echo "🗂️  Generating file moves map..."
cat > .reports/moves-map.csv << 'EOF'
from,to,reason
components/,src/ui/components/,Move components to src/ui structure
lib/,src/lib/,Move lib to src/lib structure
app/,src/app/,Consolidate app directory (if different from src/app)
prompts/,src/lib/prompts/,Move prompts to lib structure
EOF

# 4. Generate markdown actions
echo "📄 Generating markdown actions..."
cat > .reports/md-actions.csv << 'EOF'
path,action,reason
README.md,KEEP,root-canonical
SETUP_GUIDE.md,MOVE,setup-guide
LAUNCH_CHECKLIST.md,MOVE,checklist-guide
BUILD_COMPLETE.md,ARCHIVE,completed-build-note
API_INGESTION_SUMMARY.md,MOVE,api-reference
docs/LAUNCH_PLANS.md,KEEP,already-in-docs
docs/guides/VENDOR_PRICING.md,KEEP,already-organized
docs/references/DESIGN_VISION_FOR_AI.md,KEEP,already-organized
EOF

# 5. Check for analysis tools and run if available
echo "🔧 Running analysis tools..."
if command -v npm >/dev/null 2>&1; then
  echo "Running npm-based analysis..."
  # Check if knip is available
  if npm list knip >/dev/null 2>&1 || npm list -g knip >/dev/null 2>&1; then
    echo "Running knip..."
    npx knip --reporter json > .reports/knip.json 2>&1 || echo '{"noIssues": true}' > .reports/knip.json
  else
    echo '{"available": false}' > .reports/knip.json
  fi
  
  # Check for depcheck
  if npm list depcheck >/dev/null 2>&1 || npm list -g depcheck >/dev/null 2>&1; then
    echo "Running depcheck..."
    npx depcheck --json > .reports/depcheck.json 2>&1 || echo '{"dependencies": {}, "devDependencies": {}}' > .reports/depcheck.json
  else
    echo '{"available": false}' > .reports/depcheck.json
  fi
else
  echo '{"available": false}' > .reports/knip.json
  echo '{"available": false}' > .reports/depcheck.json
fi

# 6. Generate clean plan summary
echo "📋 Generating clean plan..."
write_file ".reports/clean-plan.md" "# Repository Deep Clean Plan

## Configuration
- **Bias**: $BIAS
- **Layout Root**: $LAYOUT
- **App Type**: $APP
- **Package Manager**: $PM

## Analysis Results

### Directory Structure
- Current structure captured in: \`.reports/tree-before.txt\`
- Target structure: \`$LAYOUT/{app,features,ui,shared,lib,server}/\`

### Proposed File Moves
See \`.reports/moves-map.csv\` for detailed file move plan.

### Markdown Files
See \`.reports/md-actions.csv\` for markdown file actions:
- **KEEP**: Root canonical files (README.md, LICENSE.md, etc.)
- **MOVE**: Move to appropriate docs/ subdirectory
- **ARCHIVE**: Move to \`_archive/\$(date +%Y-%m-%d)/\`
- **DELETE**: Remove completely (only if tiny + boilerplate)

### Dead Code Analysis
- knip: \`.reports/knip.json\`
- depcheck: \`.reports/depcheck.json\`

## Next Steps

1. **Review Reports**: Check all files in \`.reports/\`
2. **Approve Changes**: Run \`echo YES > .reports/APPROVED\` or set \`approve=YES\`
3. **Apply Changes**: Re-run with \`mode=apply\`

## Files to Review

- \`.reports/moves-map.csv\` - Code file moves
- \`.reports/md-actions.csv\` - Markdown file actions
- \`.reports/clean-plan.md\` - This file (summary)
- \`.reports/tree-before.txt\` - Current directory structure
"

# 7. Generate dry-run commands script
echo "💻 Generating dry-run commands..."
cat > .reports/commands-dry-run.sh << 'EOF'
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
EOF

chmod +x .reports/commands-dry-run.sh

echo ""
echo "✅ Analysis complete!"
echo ""
echo "📊 Reports generated in .reports/:"
echo "   - clean-plan.md (summary)"
echo "   - moves-map.csv (file moves)"
echo "   - md-actions.csv (markdown actions)"
echo "   - commands-dry-run.sh (proposed commands)"
echo ""
echo "📖 Review the reports, then:"
echo "   1. Check .reports/clean-plan.md for full summary"
echo "   2. Review .reports/moves-map.csv and .reports/md-actions.csv"
echo "   3. Approve by running: echo YES > .reports/APPROVED"
echo "   4. Apply changes by re-running with mode=apply"

