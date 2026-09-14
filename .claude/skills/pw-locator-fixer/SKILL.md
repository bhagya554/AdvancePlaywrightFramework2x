---
name: pw-locator-fixer
description: >-
  Scans a spec or Page Object for brittle locators and rewrites them to this
  framework's data-test convention. Use when someone says "fix these locators",
  "my selectors are flaky", "replace XPath", "make these locators resilient", or
  pastes code full of nth-child / CSS-class / raw-text selectors. Produces a
  before/after rewrite map plus patched code — the engineer verifies each swap.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Locator Fixer

You audit locators and **propose replacements the engineer must verify** against the
live DOM. A swap that reads well can still target the wrong node.

## The ladder for this repo

TTACart marks every meaningful element with `data-test`, so the generic
"role first, testid last" ladder is inverted here:

1. `page.locator('[data-test="…"]')` — the house convention. Every implemented POM
   uses it. Use it first.
2. `getByRole(...)` / `getByLabel(...)` — only where no `data-test` exists.
3. `getByText(..., { exact: true })` — last resort, and only for static copy.

Never: XPath, `.nth(n)`, `:nth-child`, CSS-class chains (`.login-form input.username`),
or deep descendant selectors. These are what you are removing.

## Where the locator belongs

A locator in a spec is a finding even when it is well written. Locators live in the
Page Object as `private readonly` fields; the spec calls a POM method. If the fix
requires an element no POM exposes, the rewrite includes the POM change.

## Workflow
1. **Scan** and flag every brittle locator: XPath, index-based, class-based,
   unanchored text, and any locator sitting in a spec instead of a POM.
2. **Rewrite** each one to `[data-test="…"]`, preserving intent. Where the original
   relied on position or copy that maps to no `data-test`, mark
   `// TODO: needs data-test` — never invent an attribute the app does not ship.
3. **Route the action through `this.el.*`** while you are there. `locator.click()`
   inside a POM is a second, quieter bug: it skips the logged wrapper.
4. **Emit a rewrite map** (before → after → why) so the diff is reviewable.
5. **Call out multi-match risk.** Playwright is strict-mode; a broader selector that
   now matches two nodes fails at runtime, not at typecheck.
6. **Verify** — `npm run typecheck`, then run the affected spec.

## Output shape
```
Rewrite map
  ✗ page.locator('//button[2]')              → ✓ [data-test="login-button"]
  ✗ page.locator('.inventory_item')          → ✓ [data-test="inventory-item"]
  ✗ page.locator('tr:nth-child(3) td')       → ✓ [data-test="cart-item"] .nth() removed,
                                                 filter by name instead
  ✗ spec-level page.locator('[data-test=x]') → ✓ moved into InventoryPage as a field
  ✗ page.locator('.err-msg')                 → ✓ // TODO: needs data-test
```
```typescript
// before — brittle, and in the spec
await page.locator('.login-form input.username').fill('standard_user');

// after — in LoginPage, routed through the logged wrapper
this.username = page.locator('[data-test="username"]');
await this.el.fill(this.username, username);
```

## Guardrails
- These are **proposed swaps the engineer must run and confirm** — never assume the
  new locator resolves to the same element without checking the real DOM.
- Never invent a `data-test` value. If none exists, flag that the app needs one.
- Do not "fix" a locator by adding `waitForTimeout` or `.first()` to dodge strict
  mode — a multi-match is a real ambiguity; resolve it by narrowing the selector.
- Preserve behaviour: changing a locator's count or strictness silently is a defect,
  not a cleanup. Call it out.
- `getByRole` is not an upgrade over `[data-test]` in this repo. Matching the
  surrounding code is the point.
