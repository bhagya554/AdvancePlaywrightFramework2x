---
mode: agent
description: Scan a spec or Page Object for brittle locators and rewrite them to this framework's data-test convention, with a before/after rewrite map.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Locator Fixer

Audit and fix the locators in: `${input:target:Which spec or Page Object should I audit?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. These
are **proposed swaps the engineer must verify against the live DOM** — a swap that
reads well can still target the wrong node.

## The ladder for this repo — inverted from generic advice

TTACart marks every meaningful element with `data-test`, so:

1. `page.locator('[data-test="…"]')` — the house convention, first choice.
2. `getByRole` / `getByLabel` — only where no `data-test` exists.
3. `getByText(..., { exact: true })` — last resort, static copy only.

Never: XPath, `.nth(n)`, `:nth-child`, CSS-class chains, deep descendant selectors.
`getByRole` is **not** an upgrade over `[data-test]` here.

## Where a locator belongs

A locator in a spec is a finding even when well written. Locators live in the Page
Object as `private readonly` fields; the spec calls a POM method. If the fix needs an
element no POM exposes, the rewrite includes the POM change.

## Workflow

1. **Scan** and flag every brittle locator, plus every locator sitting in a spec.
2. **Rewrite** to `[data-test="…"]`, preserving intent. Where nothing maps, mark
   `// TODO: needs data-test` — never invent an attribute the app does not ship.
3. **Route the action through `this.el.*`** while you are there. A raw
   `locator.click()` inside a POM is a second, quieter bug: no log trail.
4. **Emit a rewrite map** — before → after → why.
5. **Call out multi-match risk.** Playwright is strict-mode; a broader selector that
   now matches two nodes fails at runtime, not at typecheck.
6. **Verify** — `npm run typecheck`, then run the affected spec.

## Rewrite map format

```
✗ page.locator('//button[2]')          → ✓ [data-test="login-button"]
✗ page.locator('.inventory_item')      → ✓ [data-test="inventory-item"]
✗ spec-level page.locator(...)         → ✓ moved into InventoryPage as a field
✗ page.locator('.err-msg')             → ✓ // TODO: needs data-test
```

## Do not

- Dodge strict mode with `.first()` or a sleep. A multi-match is a real ambiguity —
  narrow the selector.
- Change a locator's count or strictness silently. That is a defect, not a cleanup.
- Claim a swap is verified when you could not check the real DOM. Say what is unconfirmed.
