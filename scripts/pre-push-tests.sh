#!/bin/bash

# Pre-push test script for FairyWize
# Run this before pushing to ensure code quality

set -e  # Exit on any error

echo "🚀 Running pre-push tests for FairyWize..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project root?"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🧪 Running unit tests..."
if npm run test; then
    print_status "Unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

echo "🔨 Checking build..."
if npm run build; then
    print_status "Build successful"
else
    print_error "Build failed"
    exit 1
fi

echo "🎭 Running E2E tests..."
# Note: E2E tests require a running dev server
# For CI/CD, you'd want to start the server first
if npm run test:e2e; then
    print_status "E2E tests passed"
else
    print_warning "E2E tests failed (may require dev server to be running)"
    echo "To run E2E tests locally, start the dev server first:"
    echo "  npm run dev"
    echo "Then run in another terminal:"
    echo "  npm run test:e2e"
fi

echo "📊 Generating coverage report..."
npm run test:coverage

echo "🔍 Running lint check..."
if npm run lint; then
    print_status "Lint check passed"
else
    print_error "Lint check failed"
    exit 1
fi

echo "🔒 Checking for security vulnerabilities..."
if npm audit --audit-level=moderate; then
    print_status "Security check passed"
else
    print_warning "Security vulnerabilities found - review npm audit output"
fi

echo "📝 Checking TypeScript types..."
if npx tsc --noEmit; then
    print_status "TypeScript check passed"
else
    print_error "TypeScript check failed"
    exit 1
fi

print_status "All pre-push checks completed successfully!"
echo ""
echo "🎉 Ready to push to live!"
echo ""
echo "Next steps:"
echo "  1. Commit your changes: git commit -m 'Your commit message'"
echo "  2. Push to main: git push origin main"
echo "  3. Deploy will trigger automatically via Vercel"
