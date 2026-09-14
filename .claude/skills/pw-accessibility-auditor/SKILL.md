---
name: pw-accessibility-auditor
description: >-
  Integrates automated accessibility checks into this framework's tests using
  axe-core. Use when someone says "add a11y checks", "run axe on this page",
  "audit accessibility", "check WCAG compliance", or "triage these accessibility
  violations". Produces @axe-core/playwright tests, severity triage and WCAG
  mapping — a draft the engineer runs, knowing axe catches only ~30-40%.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Accessibility Auditor

You wire in **automated a11y checks the engineer must run and supplement with manual
testing** — axe catches a fraction of issues, never all of them.

## Prerequisite: the dependency is not installed

`@axe-core/playwright` is **not** in [package.json](../../../package.json). Say so
before writing code, and give the exact command:

```bash
npm i -D @axe-core/playwright
```

Everything in this repo is a `devDependency` — nothing ships — so that is the correct
flag. Do not silently write an import for a package that is not there; the spec will
fail at collection and look like a framework problem.

## Framework fit

- Spec goes under `src/tests/` (`testDir`), e.g. `src/tests/a11y/`.
- Import `test` from `@fixtures/test-base` and take both the state fixture and `page` —
  `AxeBuilder` needs the raw `Page`, the fixture gets you to the right screen without
  re-doing login.
- Reach the page through `somePage.open()` / a state fixture, never a literal URL.
- Scan **after** the page is ready: call the POM's `assertLoaded()` first. Scanning a
  half-rendered DOM produces violations that vanish on re-run.
- TTACart marks elements with `data-test`, not ARIA. Expect real findings around
  names, roles and labels — that is the point, not a false positive.

## Workflow
1. **Integrate `@axe-core/playwright`** — run `AxeBuilder` after a web-first
   readiness assertion, scanning the real rendered DOM.
2. **Scope the scan** — `.include()` / `.exclude()` to the component under test; tag
   rules (`wcag2a`, `wcag2aa`) to the standard the product is held to.
3. **Triage by impact** — `critical` / `serious` / `moderate` / `minor`. Gate on
   critical + serious; record the rest as tracked debt, do not silently pass.
4. **Map each violation to WCAG** — axe returns `tags` and `helpUrl`; surface the
   success criterion (1.4.3 contrast, 4.1.2 name/role/value) so it is actionable.
5. **Attach the full report** to the test so the custom reporter carries it —
   `testInfo.attach` beats a console dump nobody reads.
6. **Flag the coverage gap** — keyboard, focus order, screen reader and cognitive
   checks need a human. Automation is the floor.

## Output shape
```typescript
import { test, expect } from '@fixtures/test-base';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility @a11y', () => {
    test('inventory page has no critical or serious violations', async ({
        page, loginWithInventory,
    }, testInfo) => {
        await loginWithInventory.assertLoaded();     // scan a settled DOM

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        await testInfo.attach('axe-results', {
            body: JSON.stringify(results.violations, null, 2),
            contentType: 'application/json',
        });

        const blocking = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious');

        expect(
            blocking.map((v) => `${v.id} (${v.impact}) — ${v.helpUrl}`),
        ).toEqual([]);
    });
});
```

## Guardrails
- Automated axe checks are the **floor** — this is a draft the engineer must run and
  back with manual keyboard and screen-reader testing. Never claim "fully accessible".
- **State the missing dependency first.** An import of an uninstalled package is not a
  draft, it is a broken spec.
- Never assume a selector or region exists; scan the real rendered DOM after it settles.
- Don't fabricate WCAG criteria — use the `tags` and `helpUrl` axe actually returns.
- Gate on critical + serious; record moderate and minor as tracked debt rather than
  dropping them or failing the build on cosmetics.
- Do not add `data-test` attributes as an accessibility fix. They are test hooks;
  they give an element no accessible name.