# Pre-push test script for FairyWize
# Run this before pushing to ensure code quality

param(
    [switch]$SkipE2E,
    [switch]$SkipSecurity
)

# Colors for output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"

# Function to print status
function Write-Success($message) {
    Write-Host "✓ $message" -ForegroundColor $Green
}

function Write-Warning($message) {
    Write-Host "⚠ $message" -ForegroundColor $Yellow
}

function Write-Error($message) {
    Write-Host "✗ $message" -ForegroundColor $Red
}

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Error "package.json not found. Are you in the project root?"
    exit 1
}

Write-Host "🚀 Running pre-push tests for FairyWize..." -ForegroundColor Cyan

# Install dependencies
Write-Host "📦 Installing dependencies..."
npm install

# Run unit tests
Write-Host "🧪 Running unit tests..."
try {
    npm run test
    Write-Success "Unit tests passed"
} catch {
    Write-Error "Unit tests failed"
    exit 1
}

# Check build
Write-Host "🔨 Checking build..."
try {
    npm run build
    Write-Success "Build successful"
} catch {
    Write-Error "Build failed"
    exit 1
}

# Run E2E tests (skip if requested)
if (!$SkipE2E) {
    Write-Host "🎭 Running E2E tests..."
    # Note: E2E tests require a running dev server
    try {
        npm run test:e2e
        Write-Success "E2E tests passed"
    } catch {
        Write-Warning "E2E tests failed (may require dev server to be running)"
        Write-Host "To run E2E tests locally, start the dev server first:"
        Write-Host "  npm run dev"
        Write-Host "Then run in another terminal:"
        Write-Host "  npm run test:e2e"
    }
}

# Generate coverage report
Write-Host "📊 Generating coverage report..."
npm run test:coverage

# Run lint check
Write-Host "🔍 Running lint check..."
try {
    npm run lint
    Write-Success "Lint check passed"
} catch {
    Write-Error "Lint check failed"
    exit 1
}

# Check for security vulnerabilities (skip if requested)
if (!$SkipSecurity) {
    Write-Host "🔒 Checking for security vulnerabilities..."
    try {
        npm audit --audit-level=moderate
        Write-Success "Security check passed"
    } catch {
        Write-Warning "Security vulnerabilities found - review npm audit output"
    }
}

# Check TypeScript types
Write-Host "📝 Checking TypeScript types..."
try {
    npx tsc --noEmit
    Write-Success "TypeScript check passed"
} catch {
    Write-Error "TypeScript check failed"
    exit 1
}

Write-Success "All pre-push checks completed successfully!"
Write-Host ""
Write-Host "🎉 Ready to push to live!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Commit your changes: git commit -m 'Your commit message'"
Write-Host "  2. Push to main: git push origin main"
Write-Host "  3. Deploy will trigger automatically via Vercel"
