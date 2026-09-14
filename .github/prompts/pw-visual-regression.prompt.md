---
mode: agent
description: Set up Playwright visual regression — toHaveScreenshot with masking, thresholds and a stated baseline strategy.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Visual Regression

Add visual regression for: `${input:target:Which page or component should I snapshot?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`.
Baselines are **generated then human-reviewed** — never auto-approve. A wrong baseline
locks in the bug.

## Starting position

- **No visual tests exist yet**, no baselines committed. Greenfield — state the
  strategy decisions explicitly.
- **One `chromium` project.** Baselines are per-project and per-platform: a PNG
  generated on Windows will not match the Ubuntu CI runner. **Decide up front whether
  baselines are generated in CI (recommended) or locally, and say so** — without that
  decision the suite goes red on its first CI run.
- `screenshot: 'only-on-failure'` (config) and `ATTACH_SCREENSHOTS` (visualStep) have
  nothing to do with `toHaveScreenshot`. Do not couple them.
- Snapshots land in `<spec>-snapshots/` and **are** committed. `test-results/` and
  `tta-report/` are not.

## Workflow

1. **Smallest stable target** — a component locator, not a full page.
2. **Get the locator from the Page Object.** A `page.locator(...)` in the spec is a
   finding here; expose it on the POM if missing.
3. **Neutralise non-determinism** — `animations: 'disabled'`, `mask` dynamic regions
   (prices, timestamps, Faker-generated names), pin the viewport, use a fixed persona.
4. **Set tolerance once** in the config's `expect.toHaveScreenshot`, not per call.
5. **Generate, then review every PNG by eye** before committing:
   `npm test -- src/tests/visual --update-snapshots`
6. **Document the refresh flow** so baselines change intentionally.

## Shape

```typescript
test.use({ viewport: { width: 1280, height: 720 } });

test('product grid matches baseline', async ({ loginWithInventory, page }) => {
    await loginWithInventory.assertLoaded();          // web-first, not a sleep
    await expect(page.locator('[data-test="inventory-list"]')).toHaveScreenshot(
        'inventory-grid.png',
        { animations: 'disabled',
          mask: [page.locator('[data-test="inventory-item-price"]')],
          maxDiffPixelRatio: 0.01 });
});
```

## Do not

- Auto-approve a baseline, or generate one without reviewing the PNG.
- Leave the local-vs-CI baseline question unanswered — that is a guaranteed red build.
- Snapshot unmasked Faker-generated content.
- Use `waitForTimeout` before snapping.
- Snapshot whole pages — committed baselines are binary and grow the repo. Delete
  baselines for tests you remove.
- Forget that CI currently uploads only `playwright-report/`; diffs need the workflow
  updated to be reviewable.
