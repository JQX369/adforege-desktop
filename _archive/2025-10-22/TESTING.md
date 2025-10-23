# FairyWize Testing Guide

This document outlines the testing strategy and procedures for FairyWize to ensure code quality before deployment.

## 🧪 Test Types

### Unit Tests

- **Framework**: Vitest
- **Location**: `__tests__/` directory
- **Coverage**: Core utilities, components, API logic
- **Run**: `npm test`

### Integration Tests

- **Framework**: Vitest
- **Location**: `__tests__/api/` and `__tests__/middleware.test.ts`
- **Coverage**: API endpoints, middleware, database interactions
- **Run**: `npm test`

### End-to-End Tests

- **Framework**: Playwright
- **Location**: `e2e/` directory
- **Coverage**: User journeys, SEO, performance
- **Run**: `npm run test:e2e`

### SEO & Performance Tests

- **Framework**: Custom validation functions
- **Location**: `__tests__/seo/`
- **Coverage**: Meta tags, structured data, Core Web Vitals
- **Run**: `npm test`

## 🚀 Quick Test Commands

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Generate coverage report
npm run test:coverage

# Run all tests (unit + E2E)
npm run test:all

# Pre-push validation (Windows)
.\scripts\pre-push-tests.ps1

# Pre-push validation (Linux/Mac)
./scripts/pre-push-tests.sh
```

## 📋 Pre-Push Checklist

Run this checklist before pushing to production:

### ✅ Code Quality

- [ ] All unit tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript check passes (`npx tsc --noEmit`)
- [ ] Test coverage > 80%

### ✅ Functionality

- [ ] Currency switching works (USD → GBP → EUR)
- [ ] Gift guides load correctly
- [ ] API endpoints return valid data
- [ ] Mobile responsiveness verified

### ✅ SEO & Performance

- [ ] Meta tags present and correct
- [ ] Structured data validates
- [ ] Page load < 3 seconds
- [ ] Core Web Vitals pass

### ✅ Security

- [ ] No high/critical vulnerabilities (`npm audit`)
- [ ] Environment variables properly configured
- [ ] Sensitive data not logged

## 🏗️ Test Structure

```
__tests__/
├── setup.ts                    # Global test setup
├── lib/
│   ├── prices.test.ts         # Currency detection
│   └── currency-context.test.tsx # React context
├── api/
│   └── guides/
│       └── top.test.ts        # Top-saved API
├── middleware.test.ts          # Currency middleware
└── seo/
    └── validation.test.ts      # SEO validation

e2e/
└── currency-switching.spec.ts  # E2E user journeys

scripts/
├── pre-push-tests.sh          # Linux/Mac validation
└── pre-push-tests.ps1         # Windows validation
```

## 🔧 Test Configuration

### Vitest Configuration (`vitest.config.ts`)

- **Environment**: jsdom (for React components)
- **Globals**: Enabled
- **Coverage**: V8 provider with reports
- **Setup**: Global mocks and utilities

### Playwright Configuration

- **Browser**: Chromium (default)
- **Parallel**: Enabled for faster execution
- **Retries**: 2 attempts on failure

## 🧪 Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { getCurrencyFromCountry } from '@/lib/prices'

describe('Currency Detection', () => {
  it('should return GBP for UK', () => {
    expect(getCurrencyFromCountry('GB')).toBe('GBP')
  })
})
```

### Component Test Example

```typescript
import { render, screen } from '@testing-library/react'
import { CurrencyProvider } from '@/lib/currency-context'

const TestComponent = () => {
  const { currency } = useCurrency()
  return <div>{currency}</div>
}

it('should render with default currency', () => {
  render(
    <CurrencyProvider>
      <TestComponent />
    </CurrencyProvider>
  )
  expect(screen.getByText('USD')).toBeInTheDocument()
})
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test'

test('should switch currencies', async ({ page }) => {
  await page.goto('/')
  await page.click('button:has-text("$")')
  await page.click('text=£ GBP')
  await expect(page.locator('button')).toContainText('£')
})
```

## 📊 Coverage Requirements

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

View coverage report: `npm run test:coverage`

## 🚨 CI/CD Integration

Tests automatically run on:

- **Pull Requests**: All tests + coverage
- **Main Branch**: Full test suite + E2E
- **Deploy**: Build validation only

### GitHub Actions Workflow

```yaml
- name: Run Tests
  run: |
    npm ci
    npm test
    npm run test:coverage

- name: Run E2E Tests
  run: |
    npm run build
    npm run test:e2e
```

## 🐛 Debugging Tests

### Common Issues

**Tests failing in CI but passing locally:**

- Check environment variables
- Verify database connections
- Check for race conditions

**E2E tests timing out:**

- Increase timeout in playwright config
- Add proper wait conditions
- Check for network issues

**Coverage not updating:**

- Clear coverage cache: `rm -rf coverage/`
- Run tests with `--run` flag
- Check file paths in coverage config

### Debugging Commands

```bash
# Debug specific test
npm test -- --run prices.test.ts

# Debug with inspector
npm test -- --inspect-brk

# Run tests in verbose mode
npm test -- --reporter=verbose

# Debug E2E test
npx playwright test --debug currency-switching.spec.ts
```

## 📈 Performance Benchmarks

### Test Execution Times

- **Unit Tests**: < 30 seconds
- **Integration Tests**: < 60 seconds
- **E2E Tests**: < 5 minutes
- **Full Suite**: < 7 minutes

### Coverage Targets

- Maintain > 80% coverage
- No new code without tests
- Critical paths > 90% coverage

## 🔄 Test Maintenance

### Regular Tasks

- [ ] Update snapshots monthly
- [ ] Review and update flaky tests
- [ ] Add tests for new features
- [ ] Update E2E tests after UI changes

### Test Data Management

- Use factories for consistent test data
- Mock external APIs
- Clean up test databases
- Avoid hardcoded IDs

## 📞 Support

For testing issues:

1. Check this guide first
2. Review recent changes
3. Run tests locally with `--verbose`
4. Check CI logs
5. Create issue with reproduction steps

---

**Remember**: Tests are your safety net. Well-tested code deploys with confidence! 🚀
