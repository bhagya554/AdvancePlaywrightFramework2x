---
name: pw-visual-regression
description: >-
  Sets up Playwright visual/screenshot regression testing in this framework. Use
  when someone says "add visual regression", "snapshot this component", "set up
  toHaveScreenshot", "mask the dynamic parts of this page", or "manage
  baselines". Produces snapshot tests with masking, thresholds and a baseline
  strategy — a draft the engineer runs to generate and review the first baselines.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Visual Regression

You set up **snapshot tests whose first baselines the engineer must generate and
eyeball**. Never trust an auto-approved baseline — a wrong one locks in the bug.

## Starting position in this repo

- **No visual tests exist yet** and no baselines are committed. This is a greenfield
  addition, so the strategy decisions are yours to state explicitly.
- **One `chromium` project.** Baselines are per-project and per-platform: a PNG
  generated on this Windows machine will not match the Ubuntu CI runner. Decide up
  front whether baselines are generated in CI (recommended) or locally, and say so.
  Without that decision the suite goes red on its first CI run.
- `screenshot: 'only-on-failure'` in the config governs Playwright's automatic
  failure capture. `ATTACH_SCREENSHOTS` governs `visualStep`'s per-step PNGs. Neither
  has anything to do with `toHaveScreenshot` — do not couple them.
- Snapshots default next to the spec in `<spec>-snapshots/`. Those PNGs **are**
  committed; `test-results/` and `tta-report/` are not.

## Workflow
1. **Pick the smallest stable target** — a component locator from the Page Object,
   not a full page. Less surface means fewer false diffs.
2. **Get the locator from the POM.** A `page.locator(...)` in the spec is a finding
   here; expose the element on the Page Object if it is missing.
3. **Neutralise non-determinism before snapping:** `animations: 'disabled'`, `mask`
   dynamic regions (prices, generated names from Faker, timestamps), pin the
   viewport, and use a fixed persona — not `DataGenerator` output, which changes
   every run and will diff forever.
4. **Set tolerances deliberately** — `maxDiffPixelRatio` in the config's
   `expect.toHaveScreenshot`, not sprinkled per call.
5. **Generate baselines**, then **review every PNG by eye** before committing.
6. **Document the refresh flow** so baselines are updated intentionally.

```bash
npm test -- src/tests/visual --update-snapshots   # generate, then review the PNGs
```

## Output shape
```typescript
import { test, expect } from '@fixtures/test-base';

test.describe('Inventory visuals', () => {
    test.use({ viewport: { width: 1280, height: 720 } });   // pin it

    test('product grid matches baseline', async ({ loginWithInventory, page }) => {
        await loginWithInventory.assertLoaded();            // web-first: wait for render

        await expect(page.locator('[data-test="inventory-list"]')).toHaveScreenshot(
            'inventory-grid.png',
            {
                animations: 'disabled',
                mask: [page.locator('[data-test="inventory-item-price"]')],
                maxDiffPixelRatio: 0.01,
            },
        );
    });
});
```

Config side, so tolerance is one decision rather than many:

```typescript
// playwright.config.ts
expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
},
```

## Guardrails
- Baselines are **generated then human-reviewed** — never auto-approve.
- **Decide where baselines are generated before writing the first test.** Local PNGs
  plus a Linux CI runner is a guaranteed red build; say which one is authoritative.
- Mask every dynamic region and disable animations, or diffs flake.
- Never snapshot Faker-generated content unmasked.
- Do not use `waitForTimeout` before snapping — wait on `assertLoaded()` or a
  web-first assertion.
- Committed baselines are binary and grow the repo. Snapshot components, not pages,
  and delete baselines for tests you remove.
- Adding visual tests changes what CI uploads; the workflow currently uploads only
  `playwright-report/`. Update it if diffs need to be reviewable.