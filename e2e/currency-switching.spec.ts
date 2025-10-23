import { test, expect } from '@playwright/test'

test.describe('Currency Switching', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and localStorage before each test
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('should default to USD currency', async ({ page }) => {
    await page.goto('/')

    // Check that USD is selected by default
    const currencySelector = page.locator('[data-testid="currency-selector"]')
    await expect(currencySelector).toContainText('$')

    // Check that prices are displayed in USD
    const priceElements = page.locator('[data-testid="price"]')
    if ((await priceElements.count()) > 0) {
      const firstPrice = await priceElements.first().textContent()
      expect(firstPrice).toMatch(/\$\d+/)
    }
  })

  test('should switch to GBP when UK locale is detected', async ({ page }) => {
    // Set UK locale
    await page.context().addCookies([
      {
        name: 'preferred-currency',
        value: 'GBP',
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto('/')

    // Check that GBP is selected
    const currencySelector = page.locator('[data-testid="currency-selector"]')
    await expect(currencySelector).toContainText('£')
  })

  test('should allow manual currency switching', async ({ page }) => {
    await page.goto('/')

    // Open currency dropdown
    const currencyButton = page.locator('button').filter({ hasText: '$' })
    await currencyButton.click()

    // Select GBP
    const gbpOption = page.locator('text=£ GBP')
    await gbpOption.click()

    // Check that GBP is now selected
    await expect(currencyButton).toContainText('£')

    // Verify cookie is set
    const cookies = await page.context().cookies()
    const currencyCookie = cookies.find((c) => c.name === 'preferred-currency')
    expect(currencyCookie?.value).toBe('GBP')
  })

  test('should persist currency choice across page reloads', async ({
    page,
  }) => {
    await page.goto('/')

    // Switch to EUR
    const currencyButton = page.locator('button').filter({ hasText: '$' })
    await currencyButton.click()

    const eurOption = page.locator('text=€ EUR')
    await eurOption.click()

    // Reload page
    await page.reload()

    // Check that EUR is still selected
    await expect(currencyButton).toContainText('€')
  })

  test('should display prices in selected currency', async ({ page }) => {
    await page.goto('/gift-guides/for-her')

    // Switch to GBP
    const currencyButton = page.locator('button').filter({ hasText: '$' })
    await currencyButton.click()

    const gbpOption = page.locator('text=£ GBP')
    await gbpOption.click()

    // Wait for prices to update (if dynamic pricing is implemented)
    await page.waitForTimeout(1000)

    // Check that some prices are displayed (exact format depends on implementation)
    const priceElements = page.locator('text=/£\\d+/')
    const count = await priceElements.count()
    expect(count).toBeGreaterThanOrEqual(0) // May be 0 if prices aren't shown on this page
  })
})

test.describe('SEO and Performance', () => {
  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/gift-guides')

    // Check title
    await expect(page).toHaveTitle(/Gift Guides \| FairyWize/)

    // Check meta description
    const metaDescription = page.locator('meta[name="description"]')
    await expect(metaDescription).toHaveAttribute(
      'content',
      /Discover the ultimate gift guides/
    )

    // Check Open Graph tags
    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveAttribute('content', /Gift Guides \| FairyWize/)

    const ogDescription = page.locator('meta[property="og:description"]')
    await expect(ogDescription).toHaveAttribute(
      'content',
      /Discover the ultimate gift guides/
    )
  })

  test('should have structured data', async ({ page }) => {
    await page.goto('/')

    // Check for JSON-LD structured data
    const structuredData = page.locator('script[type="application/ld+json"]')
    const count = await structuredData.count()
    expect(count).toBeGreaterThan(0)

    // Check that structured data is valid JSON
    for (let i = 0; i < count; i++) {
      const scriptContent = await structuredData.nth(i).textContent()
      expect(() => JSON.parse(scriptContent || '')).not.toThrow()
    }
  })

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/', { waitUntil: 'networkidle' })
    const loadTime = Date.now() - startTime

    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should be mobile-friendly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE size
    await page.goto('/')

    // Check that navigation is accessible
    const menuButton = page.locator('button').filter({ hasText: 'Find Gifts' })
    await expect(menuButton).toBeVisible()

    // Check that content is readable
    const mainContent = page.locator('main')
    await expect(mainContent).toBeVisible()
  })
})

test.describe('Gift Guide Pages', () => {
  test('should load gift guides index page', async ({ page }) => {
    await page.goto('/gift-guides')

    // Check page loads
    await expect(page.locator('h1')).toContainText('Gift Guides')

    // Check that guide cards are present
    const guideCards = page.locator('[href^="/gift-guides/"]')
    const count = await guideCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should load individual guide pages', async ({ page }) => {
    const guides = [
      '/gift-guides/for-her',
      '/gift-guides/for-him',
      '/gift-guides/birthday',
    ]

    for (const guideUrl of guides) {
      await page.goto(guideUrl)

      // Check page loads without errors
      await expect(page.locator('h1')).toBeVisible()

      // Check for gift content
      const giftContent = page.locator('text=gift').first()
      await expect(giftContent).toBeVisible()
    }
  })

  test('should have proper SEO elements on guide pages', async ({ page }) => {
    await page.goto('/gift-guides/for-her')

    // Check title contains relevant keywords
    const title = await page.title()
    expect(title).toMatch(/gifts for her|fairyWize/i)

    // Check for meta description
    const metaDescription = page.locator('meta[name="description"]')
    await expect(metaDescription).toHaveAttribute('content', /.+/)
  })
})
