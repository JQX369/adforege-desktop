# UI Test & Fix — Accessibility, Visual, Interaction, Perf, Responsive

## Goal
Find and fix UI defects comprehensively: accessibility, keyboard flow, screen reader semantics, visual regressions, micro-interaction bugs, responsiveness, theme parity, i18n/RTL, and performance (LCP/INP).

## Inputs
- Critical journeys: {{journeys|signup → create → share}}
- Browsers/Targets: {{targets|Chromium, WebKit, Firefox}}
- Breakpoints: {{bps|sm, md, lg, xl}}
- Themes: {{themes|light,dark}}
- Locales (truncate check): {{locales|en,de,ar}}
- Perf budgets: {{perf|LCP<2.5s INP<200ms CLS<0.1}}

## Setup (one-time; paste as needed)
npm i -D playwright @playwright/test @axe-core/playwright @testing-library/react @testing-library/user-event jest-axe \
  storybook @storybook/test @storybook/addon-a11y @storybook/addon-interactions loki \
  lighthouse lhci puppeteer \
  ts-node tsx vitest

npx playwright install

## Test Matrix (what we will check)
- **A11y**: roles/labels, tab order, focus visible, color contrast AA, traps, reduced motion.
- **Visual**: component states via Storybook snaps (Loki) + critical pages via Playwright screenshots.
- **Interaction**: keyboard parity for all actions; async states (loading/success/error).
- **Responsive**: at {{bps}} across {{targets}}; layout overflow/truncation.
- **Theme Parity**: light/dark, high-contrast optional.
- **i18n/RTL**: long strings (German), RTL (Arabic/Hebrew), pluralization.
- **Perf**: LCP/CLS/INP with Lighthouse CI on 3 key routes; lazy vs eager.
- **Content**: empty states, error states, copy clarity.
- **Motion**: durations/curves per motion spec; respect prefers-reduced-motion.

## Steps (Plan & Execute)
1) **Inventory**
   - Enumerate routes/components (Storybook stories must exist for all public components and states).
2) **Automated A11y Sweep**
   - Playwright + axe on each route; write failing tests with selectors and guidance.
3) **Visual Regression**
   - Storybook + Loki for component states.
   - Playwright screenshots for 5 critical pages @ {{bps}} × {{themes}}.
4) **Interaction Validation**
   - Keyboard-only journey tests (cannot touch mouse).
   - Async flows: inject latency to test loading/success/error.
5) **Responsive & i18n**
   - Snapshot with long strings; check overflow/ellipsis patterns.
   - RTL flip: ensure icons and arrows mirror correctly.
6) **Perf & Stability**
   - LHCI on landing, dashboard, heavy detail route.
   - Flag largest JS contributors; propose code-split & prefetch rules.
7) **Report & Fix Plan**
   - Rank issues by Severity (P0–P3), include repro + suggested fix + owner.
   - Emit PR checklist and re-run gates.

## Minimal Example Tests (emit these)
### a) Playwright + axe route A11y
// tests/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/dashboard', '/settings'];
for (const path of routes) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a','wcag2aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });
}

### b) Keyboard-only happy path
// tests/keyboard-flow.spec.ts
import { test, expect } from '@playwright/test';
test('keyboard: create flow', async ({ page }) => {
  await page.goto('/create');
  await page.keyboard.press('Tab'); // focus first field
  await page.keyboard.type('My Title');
  await page.keyboard.press('Tab');
  await page.keyboard.type('My Description');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); // submit
  await expect(page.getByText('Created')).toBeVisible();
});

### c) Visual regression (page)
/// tests/visual.spec.ts
import { test, expect } from '@playwright/test';
const viewports = [{ width: 360, height: 720 }, { width: 1024, height: 768 }];
for (const vp of viewports) {
  test(`visual: home ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('/');
    expect(await page.screenshot()).toMatchSnapshot(`home-${vp.width}.png`, { maxDiffPixels: 300 });
  });
}

### d) Storybook snaps with Loki (components)
# scripts (package.json)
# "loki:ci": "loki --requireReference --reactUri=http://localhost:6006"
# Run once: npx storybook dev -p 6006 &; sleep 5; npm run loki:ci

### e) jest-axe for components (unit a11y)
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
test('Button is accessible', async () => {
  const { container } = render(<Button>Save</Button>);
  expect(await axe(container)).toHaveNoViolations();
});

## Fix Patterns (quick recipes)
- **Color contrast**: update token pair (fg/base vs bg/base) to ratio ≥ 4.5:1.
- **Focus**: add `:focus-visible` ring; ensure tab order via DOM order.
- **Traps**: dialogs use focus trap; ESC/overlay close; return focus to opener.
- **Overflow**: use `text-ellipsis` and `min-w-0` on flex children; responsive clamps.
- **Async**: add skeleton then toast; avoid spinner-only.
- **Motion**: respect `prefers-reduced-motion`; cap durations: 80–240ms.
- **Perf**: code-split heavy routes; `loading="lazy"` for below-the-fold images; prefetch critical data on hover/viewport.

## Output Format
- Test Coverage Summary (routes/components with pass/fail)
- Defect List (table: area | severity | repro | suggested fix | owner)
- Perf Report (Lighthouse summary + top offenders)
- PR Checklist (below)

## PR Checklist (copy/paste)
- [ ] All routes pass axe (wcag2a/aa) & keyboard journey
- [ ] Storybook stories for all public components + states
- [ ] Visual snaps updated (reviewed by design)
- [ ] Light/Dark parity, responsive @ {{bps}}
- [ ] i18n truncation & RTL sanity
- [ ] Perf budgets met (LCP/INP/CLS)
- [ ] Motion respects reduced motion
- [ ] No TODOs in shipped UI text

## Run Block (sequential)
# 1) Storybook & Loki (component visuals)
npm run storybook & sleep 6 && npx loki --requireReference --reactUri=http://localhost:6006 || true

# 2) Playwright (routes, a11y, keyboard, visual)
npx playwright test

# 3) Lighthouse (3 key routes)
npx lhci autorun --collect.url=http://localhost:3000/ --collect.url=http://localhost:3000/dashboard --collect.url=http://localhost:3000/settings || true
