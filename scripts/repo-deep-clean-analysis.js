#!/usr/bin/env node
// Repo Deep Clean - Comprehensive Analysis
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BIAS = process.env.BIAS || 'minimal';
const LAYOUT = process.env.LAYOUT || 'src';
const REPO_ROOT = process.cwd();

// Ensure reports directory exists
const reportsDir = path.join(REPO_ROOT, '.reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Helper to write files
function writeReport(filename, content) {
  fs.writeFileSync(path.join(reportsDir, filename), content);
}

// 1. Find all markdown files
function findMarkdownFiles() {
  const markdownFiles = [];
  function walkDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === 'node_modules' || item === '.next' || item === '.git' || item === 'coverage') continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.md')) {
        markdownFiles.push(fullPath.replace(REPO_ROOT + '/', ''));
      }
    }
  }
  walkDir(REPO_ROOT);
  return markdownFiles.sort();
}

// 2. Analyze markdown files
function analyzeMarkdown(files) {
  const actions = [];
  for (const file of files) {
    const fullPath = path.join(REPO_ROOT, file);
    const basename = path.basename(file);
    const dirname = path.dirname(file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const size = fs.statSync(fullPath).size;
    
    let action = 'MOVE';
    let reason = '';
    
    // Root canonical files
    if (['README.md', 'LICENSE.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md'].includes(basename)) {
      action = 'KEEP';
      reason = 'root-canonical';
    }
    // Already in docs
    else if (file.startsWith('docs/')) {
      action = 'KEEP';
      reason = 'already-organized';
    }
    // Tiny files (< 200 bytes)
    else if (size < 200) {
      action = 'ARCHIVE';
      reason = 'tiny-file';
    }
    // Archive files
    else if (file.startsWith('_archive/')) {
      action = 'KEEP';
      reason = 'already-archived';
    }
    // Cursor files
    else if (file.startsWith('.cursor/')) {
      action = 'KEEP';
      reason = 'cursor-config';
    }
    // Reports
    else if (file.startsWith('.reports/')) {
      action = 'KEEP';
      reason = 'reports';
    }
    // Categorize others
    else {
      if (basename.includes('CHANGELOG') || basename.includes('changelog')) {
        reason = 'docs/changelog/';
      } else if (basename.includes('ADR') || basename.includes('decision')) {
        reason = 'docs/decisions/';
      } else if (basename.match(/ref|reference|API/i)) {
        reason = 'docs/references/';
      } else {
        reason = 'docs/guides/';
      }
    }
    
    actions.push({ path: file, action, reason });
  }
  return actions;
}

// 3. Generate file moves map
function generateMovesMap() {
  const moves = [];
  const movesMap = new Map();
  
  // Components -> src/ui/components
  const componentsDir = path.join(REPO_ROOT, 'components');
  if (fs.existsSync(componentsDir)) {
    const items = fs.readdirSync(componentsDir);
    for (const item of items) {
      const fullPath = path.join(componentsDir, item);
      if (fs.statSync(fullPath).isFile()) {
        const relPath = `components/${item}`;
        const target = `src/ui/components/${item}`;
        if (!movesMap.has(relPath)) {
          moves.push({ from: relPath, to: target, reason: 'components-to-ui' });
          movesMap.set(relPath, target);
        }
      } else if (fs.statSync(fullPath).isDirectory()) {
        // Handle subdirectories
        const subItems = fs.readdirSync(fullPath);
        for (const subItem of subItems) {
          const relPath = `components/${item}/${subItem}`;
          const target = `src/ui/components/${item}/${subItem}`;
          if (!movesMap.has(relPath)) {
            moves.push({ from: relPath, to: target, reason: 'components-to-ui' });
            movesMap.set(relPath, target);
          }
        }
      }
    }
  }
  
  // Root lib files -> src/lib (if not already in src/lib)
  const libDir = path.join(REPO_ROOT, 'lib');
  if (fs.existsSync(libDir)) {
    const items = fs.readdirSync(libDir);
    for (const item of items) {
      const fullPath = path.join(libDir, item);
      if (fs.statSync(fullPath).isFile()) {
        const relPath = `lib/${item}`;
        const targetDir = path.join(REPO_ROOT, 'src', 'lib');
        if (!fs.existsSync(path.join(targetDir, item))) {
          const target = `src/lib/${item}`;
          if (!movesMap.has(relPath)) {
            moves.push({ from: relPath, to: target, reason: 'lib-to-src-lib' });
            movesMap.set(relPath, target);
          }
        }
      } else if (fs.statSync(fullPath).isDirectory() && item !== 'recs') {
        // Handle subdirectories (except recs which might already be there)
        const subItems = fs.readdirSync(fullPath);
        for (const subItem of subItems) {
          const relPath = `lib/${item}/${subItem}`;
          const target = `src/lib/${item}/${subItem}`;
          if (!movesMap.has(relPath)) {
            moves.push({ from: relPath, to: target, reason: 'lib-to-src-lib' });
            movesMap.set(relPath, target);
          }
        }
      }
    }
  }
  
  // Prompts -> src/lib/prompts
  const promptsDir = path.join(REPO_ROOT, 'prompts');
  if (fs.existsSync(promptsDir)) {
    const items = fs.readdirSync(promptsDir);
    for (const item of items) {
      const relPath = `prompts/${item}`;
      const target = `src/lib/prompts/${item}`;
      moves.push({ from: relPath, to: target, reason: 'prompts-to-lib' });
    }
  }
  
  // Root app/ -> consolidate with src/app/ (if different)
  const appDir = path.join(REPO_ROOT, 'app');
  if (fs.existsSync(appDir)) {
    const items = fs.readdirSync(appDir);
    for (const item of items) {
      const relPath = `app/${item}`;
      const srcAppPath = path.join(REPO_ROOT, 'src', 'app', item);
      if (!fs.existsSync(srcAppPath)) {
        const target = `src/app/${item}`;
        moves.push({ from: relPath, to: target, reason: 'app-consolidation' });
      }
    }
  }
  
  return moves;
}

// Main execution
console.log('🔍 Running comprehensive repository analysis...');
console.log(`  Bias: ${BIAS} | Layout: ${LAYOUT}`);

// Find and analyze markdown files
console.log('📝 Analyzing markdown files...');
const markdownFiles = findMarkdownFiles();
writeReport('markdown.txt', markdownFiles.join('\n'));

const mdActions = analyzeMarkdown(markdownFiles);
const mdActionsCsv = 'path,action,reason\n' + mdActions.map(m => `${m.path},${m.action},${m.reason}`).join('\n');
writeReport('md-actions.csv', mdActionsCsv);

// Generate moves map
console.log('🗂️  Generating file moves map...');
const moves = generateMovesMap();
const movesCsv = 'from,to,reason\n' + moves.map(m => `${m.from},${m.to},${m.reason}`).join('\n');
writeReport('moves-map.csv', movesCsv);

// Generate summary
const summary = `# Repository Deep Clean Plan

## Configuration
- **Bias**: ${BIAS}
- **Layout Root**: ${LAYOUT}
- **App Type**: next
- **Package Manager**: npm

## Analysis Results

### Markdown Files
Found ${markdownFiles.length} markdown files:
- ${mdActions.filter(m => m.action === 'KEEP').length} to KEEP
- ${mdActions.filter(m => m.action === 'MOVE').length} to MOVE
- ${mdActions.filter(m => m.action === 'ARCHIVE').length} to ARCHIVE
- ${mdActions.filter(m => m.action === 'DELETE').length} to DELETE

### File Moves
Proposed ${moves.length} file moves:
- Components: ${moves.filter(m => m.reason.includes('components')).length} files
- Lib files: ${moves.filter(m => m.reason.includes('lib')).length} files
- Prompts: ${moves.filter(m => m.reason.includes('prompts')).length} files
- App consolidation: ${moves.filter(m => m.reason.includes('app')).length} files

## Next Steps

1. **Review Reports**: Check all files in \`.reports/\`
2. **Review Moves**: Check \`.reports/moves-map.csv\` for file moves
3. **Review Markdown**: Check \`.reports/md-actions.csv\` for markdown actions
4. **Approve Changes**: Run \`echo YES > .reports/APPROVED\`
5. **Apply Changes**: Re-run with \`mode=apply approve=YES\`

## Files Generated

- \`.reports/clean-plan.md\` - This summary
- \`.reports/moves-map.csv\` - Code file moves
- \`.reports/md-actions.csv\` - Markdown file actions
- \`.reports/markdown.txt\` - All markdown files found
`;

writeReport('clean-plan.md', summary);

console.log('\n✅ Analysis complete!');
console.log('\n📊 Reports generated:');
console.log('   - .reports/clean-plan.md');
console.log('   - .reports/moves-map.csv');
console.log('   - .reports/md-actions.csv');
console.log('   - .reports/markdown.txt');
console.log('\n📖 Review the reports, then approve to apply changes.');

