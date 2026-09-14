# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TypeScript UI + API test automation framework on Playwright Test. Test-only project — every dependency is a `devDependency`, nothing ships. Target app is **TTACart**, a SauceDemo-style storefront served under `baseURL` at `/playwright/ttacart/*.html`.

`src/api/` and `rules/` are still empty (`.gitkeep`). Everything else is implemented.

Requires **Node >= 22.12** — `@faker-js/faker` v10 is ESM-only and loads via `require(esm)`.

## Commands

```bash
npm test                                       # all tests
npm test -- src/tests/e2e/e2e-checkout.spec.ts # single spec
npm test -- -g "@P0"                           # filter by title/tag
npm test -- --workers=1                        # serial
npm run test:headed / test:ui / test:debug
npm run typecheck                              # tsc --noEmit — no build step exists; this is the only static check
npm run report                                 # open last HTML report
npm run install:browsers                       # required after fresh clone
npm run codegen -- https://example.com
```

No linter configured. `npm run typecheck` is the whole gate.

Environment scripts: `npm run test:qa | test:dev | test:stg | test:prod | test:api`. Each is `cross-env BASE_URL= TTA_ENV=<env> playwright test` — the blank `BASE_URL=` is load-bearing (see below), so **never** drop it when adding a new env script.

## baseURL resolution — main gotcha

`resolveBaseURL()` in [playwright.config.ts:6](playwright.config.ts#L6) returns `process.env.BASE_URL` immediately if truthy, so a `BASE_URL` line in `.env` silently pins every run to one host and makes `TTA_ENV` dead. **The local `.env` currently ships `BASE_URL=https://app.thetestingacademy.com`** — so plain `npx playwright test` is pinned right now; only the `test:<env>` scripts blank it. The committed [.env.example](.env.example) has the same trap with `https://example.com`.

Precedence: `BASE_URL` → `TTA_ENV` (default `qa`) selecting `QA_/DEV_/STG_/PROD_/API_BASE_URL` → hard-coded default per env. Aliases: `dev|local`, `stg|stage|staging`, `prod|production`, `api` (points at `restful-booker.herokuapp.com`, i.e. API suites are just a `TTA_ENV` value, not a separate Playwright project).

Adding a new environment means touching three places: the `switch` in `resolveBaseURL()`, [.env.example](.env.example), and a `test:<env>` script in [package.json](package.json).

`.env` is loaded by bare `dotenv.config()` at config top-level — CWD-relative, so tests must be run from the project root.

## Layer architecture

```
spec  →  fixture (test-base)  →  Page Object (extends BasePage)  →  UtilElementLocator  →  Playwright
                                          ↓                                ↓
                                    createLogger(scope) ──────────→ logs/combined.log
```

**[BasePage.ts](src/pages/BasePage.ts)** — abstract, constructor takes `(page, scope)` and hands subclasses `this.page`, `this.el` (a `UtilElementLocator`), `this.log` (scoped Winston child), plus `goto(relativePath)` which navigates and waits for `domcontentloaded`. It deliberately builds **no** locators; every subclass declares its own `private readonly` `Locator` fields in its constructor.

**Page objects** — each carries `static readonly PATH = '/playwright/ttacart/<page>.html'` and an `open()` that calls `goto(X.PATH)`. Never hard-code a URL in a spec; go through `open()` so `baseURL` stays environment-driven.

**[UtilElementLocators.ts](src/utils/UtilElementLocators.ts)** — logged wrappers over the element API (`click`, `fill`, `type`, `getText`, `getAllTexts`, `waitForVisible`, `selectByValue`, …). Every method takes a `Flex` = `string | Locator`, and defaults to `DEFAULT_ACTION_TIMEOUT_MS` (15s), which is separate from the config's `expect.timeout` of 10s. `type()` delegates to `pressSequentially()`. Page-object actions should route through `this.el.*` rather than calling the locator directly — that's what produces the debug log trail.

**[test-base.ts](src/fixtures/test-base.ts)** — extends `base` with two groups of fixtures. Import `test` from `@fixtures/test-base`, not `@playwright/test`, in new specs.

- **Page-object fixtures** — `loginPage`, `inventoryPage`, `itemDetailPage`, `cartPage`, `checkoutStepOnePage`/`TwoPage`/`CompletePage`. These only construct; they do not navigate.
- **State fixtures** — `validLogin`, `invalidLogin`, `loginWithInventory`, `loginWithSelectedItem`. These *do* perform setup, and they layer: `loginWithSelectedItem` → `loginWithInventory` → `validLogin`, so login happens once per test however deep the chain goes. `invalidLogin` sits deliberately outside that chain. Depend on the nearest one rather than logging in again — Playwright builds a fixture only when a test names it, so unused ones cost nothing.

Each state fixture asserts its own precondition before handing over (`validLogin` calls `waitForLoginButtonHidden()`, `invalidLogin` calls `expectErrorVisible()`). That is deliberate: without it a failed setup surfaces later at an unrelated step. Keep that pattern in any new state fixture.

Note the two import styles coexist: [e2e-checkout.spec.ts](src/tests/e2e/e2e-checkout.spec.ts) uses the fixture base, [Login.spec.ts](src/tests/login/Login.spec.ts) still does raw `@playwright/test` + manual `new LoginPage(page)`. Prefer the fixture style.

**Assertions in page objects** — the README says page objects hold no assertions, but the implemented ones do: `assertLoaded()`, `assertOrderComplete()`, `expectErrorContains()`. The working convention is: *readiness/precondition* assertions live in the POM, *behaviour under test* assertions live in the spec. Follow that; don't move outcome assertions into POMs.

**Locators** — the README says prefer `getByRole`/`getByLabel`/`getByTestId`, but every implemented page uses CSS `[data-test="..."]` strings. Match the surrounding code; TTACart marks everything with `data-test`.

## Step screenshots — visualStep + CustomReporter contract

[visualStep.ts](src/utils/visualStep.ts) wraps `test.step` and, at the end of each step, attaches a PNG named `step-<index>-<slugified-title>`. [CustomReporter.ts:298](src/utils/CustomReporter.ts#L298) matches that name prefix against its own per-test `test.step` counter to hang the screenshot on the right step in the HTML report.

Two things break this:

- **`ATTACH_SCREENSHOTS` is not set anywhere** — not in `.env`, not in any npm script. [visualStep.ts:17](src/utils/visualStep.ts#L17) reads it at module load and defaults false, so no step screenshots are produced. Set `ATTACH_SCREENSHOTS=true` (exact string, case-insensitive) to enable. This is independent of `use.screenshot` in the config, which only governs Playwright's automatic on-failure capture — do not couple the two.
- **Index drift.** The reporter counts *every* `test.step`; visualStep counts only its own calls. A spec mixing raw `test.step` with `visualStep` desynchronises the two counters and screenshots land on the wrong step. Within one spec, use one or the other.

## Config facts worth knowing

- `testDir: ./src/tests` — specs outside that tree are invisible to the runner. Subdirectories (`e2e/`, `login/`) are fine.
- Single `chromium` project. Cross-browser needs new entries in `projects`.
- `fullyParallel: true`, `retries: 2` on CI only. `forbidOnly` and the CI `workers: 1` override are **commented out** in the config — a stray `test.only` will not fail CI as-is.
- `video: 'on'` and `trace: 'on'` (every test, not just failures/retries), `screenshot: 'only-on-failure'` — `test-results/` and `tta-report/` grow fast locally, more so with `ATTACH_SCREENSHOTS=true`.
- Reporters: `html`, `list`, and [CustomReporter.ts](src/utils/CustomReporter.ts) (writes `tta-report/`, git-ignored). The custom one rewrites its HTML after every step so it can be watched live, and emits `index.html` (redirect to latest) + `history.html`.
- Timeouts: test `60_000`, expect `10_000`.
- Path aliases in [tsconfig.json](tsconfig.json): `@src/* @api/* @config/* @fixtures/* @pages/* @testdata/* @utils/*`. Playwright resolves tsconfig paths natively, so they work at runtime as well as typecheck. Existing code mixes `@src/utils/logger` and `@utils/logger` — both resolve.
- `module: preserve` / `moduleResolution: bundler` (not `Node16`) specifically so ESM-only Faker v10 typechecks.
- Allure: `npm run test:allure` writes `allure-results/`, but `allure-commandline` is **not** a project dependency — rendering needs a separate global install.

## Test data and credentials

- [credentials.ts](src/config/credentials.ts) reads `STANDARD_USER` / `TTA_SECRET`, falling back to `standard_user` / `tta_secret`. **[.env.example](.env.example) declares `USER_NAME` / `PASSWORD` instead** — those names are read by nothing. Either name is a live bug depending on which side you fix.
- [logintestdata.json](src/testdata/logintestdata.json) holds the five TTACart personas with notes on each one's behaviour. `problem_user` deliberately clears `firstName` on the first checkout-step-one submit — [CheckoutStepOnePage.ts](src/pages/CheckoutStepOnePage.ts) does **not** paper over that quirk on purpose; specs submit twice.
- [DataGenerator.ts](src/utils/DataGenerator.ts) — static Faker helpers; `checkoutCustomer()` and `userProfile()` are the composites specs actually use.
- Logging level via `LOG_LEVEL` (default `info`); `TEST_ENV` and `TEST_AUTHOR` populate columns in the custom report.

## CI

[.github/workflows/playwright.yml](.github/workflows/playwright.yml) on push/PR to `main` or `master`: `npm ci` → `playwright install --with-deps` → `playwright test` → upload `playwright-report/`. `npm ci` means `package-lock.json` must stay committed and in sync. The workflow has **no `env:` block**, so nothing from `.env` reaches CI — `TTA_ENV`, `LOG_LEVEL`, `ATTACH_SCREENSHOTS` and any credentials need mapping there from repo secrets.
