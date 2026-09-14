---
applyTo: "src/**/*.ts,playwright.config.ts"
description: Conventions every Playwright change in this framework must follow. Shared by all pw-* prompts.
---

# AdvancedFramework_2x conventions

TypeScript UI + API test framework on Playwright Test. Test-only — every dependency is
a `devDependency`. Target app is **TTACart**, served under `baseURL` at
`/playwright/ttacart/*.html`. Requires **Node ≥ 22.12**.

## Layers

```
spec → fixture (test-base) → Page Object (extends BasePage) → UtilElementLocator → Playwright
                                      ↓                              ↓
                                createLogger(scope) ────────→ logs/combined.log
```

## Specs

- `import { test, expect } from '@fixtures/test-base';` — **never** `@playwright/test`
  for a UI spec. (`src/tests/login/Login.spec.ts` still does; that is the old style.)
- Never `new SomePage(page)` in a spec. Ask for the fixture.
- Never hard-code a URL. Call `somePage.open()`.
- Specs live under `src/tests/` — `testDir` is `./src/tests`, anything outside is invisible.
- Locators belong in the Page Object, not the spec.
- Readiness assertions live in the POM (`assertLoaded()`); behaviour under test is
  asserted in the spec.
- Steps: use `visualStep` throughout **or** raw `test.step` throughout, never both in
  one spec — mixing desynchronises the CustomReporter's step counter and screenshots
  land on the wrong step.

## Fixtures — `src/fixtures/test-base.ts`

One fixture base for the whole suite. Page-object fixtures: `loginPage`,
`inventoryPage`, `itemDetailPage`, `cartPage`, `checkoutStepOnePage`,
`checkoutStepTwoPage`, `checkoutCompletePage` — they construct only, never navigate.
State fixtures (implemented, layered): `validLogin` → `loginWithInventory` →
`loginWithSelectedItem`, plus the standalone `invalidLogin`. Depend on the nearest
one rather than logging in again. Every state fixture asserts its own precondition
before `use()`.

## Page Objects — `src/pages/`

```typescript
export class XPage extends BasePage {
    static readonly PATH = '/playwright/ttacart/x.html';
    private readonly thing: Locator;

    constructor(page: Page) {
        super(page, 'XPage');                       // scope must equal the class name
        this.thing = page.locator('[data-test="thing"]');
    }

    async open(): Promise<void> { await this.goto(XPage.PATH); await this.assertLoaded(); }
    async assertLoaded(): Promise<void> { await expect(this.thing).toBeVisible(); }
    async act(): Promise<void> { await this.el.click(this.thing); }   // via this.el, always
}
```

- Locators are `private readonly` fields assigned in the constructor. `BasePage`
  builds none deliberately.
- Actions route through `this.el.*` (the logged `UtilElementLocator` wrapper). A raw
  `locator.click()` works but produces no log trail.
- `[data-test="…"]` is the convention. `getByRole` only where no `data-test` exists.
  Never XPath, `nth-child`, or CSS-class chains.

## Environment

`resolveBaseURL()` at `playwright.config.ts:6` returns `process.env.BASE_URL` if
truthy — so a `BASE_URL` line in `.env` pins every run and makes `TTA_ENV` dead.
Precedence: `BASE_URL` → `TTA_ENV` (default `qa`) → hard-coded default. The blank
`BASE_URL=` in each `test:<env>` npm script is load-bearing; never drop it.

Credentials come from `src/config/credentials.ts` (`STANDARD_USER` / `TTA_SECRET`).
`.env.example` advertises `USER_NAME` / `PASSWORD`, which nothing reads.

## Timeouts — they do not match

| Clock | Value |
| --- | --- |
| Test | 60 000 ms |
| `expect` | 10 000 ms |
| `UtilElementLocator` action | 15 000 ms (`DEFAULT_ACTION_TIMEOUT_MS`) |

When diagnosing a timeout, identify which one fired before proposing a fix.

## Verifying

- `npm run typecheck` (`tsc --noEmit`) is the **only** static gate — no linter exists.
- `npm test -- src/tests/<spec>` runs one spec; `-g "@P0"` filters by tag.
- `trace: 'on'` and `video: 'on'` for every test → evidence is already in
  `test-results/`. Action logs are in `logs/combined.log`.

## Never

- `waitForTimeout`, `networkidle`, or any manual sleep.
- A literal `https://…` in a spec or Page Object.
- An invented `data-test` value, accessible name, or endpoint — mark
  `// TODO: confirm` and say so.
- Assertions about behaviour under test inside a Page Object.
- `problem_user` clears `firstName` on the first checkout-step-one submit **by
  design** — specs submit twice. Do not paper over it in the POM.
