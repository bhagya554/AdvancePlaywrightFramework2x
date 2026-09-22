# Advanced Playwright Framework 2.x

A TypeScript-based UI and API test automation framework built on [Playwright Test](https://playwright.dev/). It targets **TTACart**, a SauceDemo-style storefront, and the public **restful-booker** API, with a layered Page Object Model, environment-driven configuration, fixture-based state setup, data-driven testing, and CI execution through GitHub Actions.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Layer Architecture](#layer-architecture)
- [Framework Building Blocks](#framework-building-blocks)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running Tests](#running-tests)
- [Reports and Artifacts](#reports-and-artifacts)
- [Playwright Configuration](#playwright-configuration)
- [TypeScript Configuration](#typescript-configuration)
- [Continuous Integration](#continuous-integration)
- [Writing a New UI Test](#writing-a-new-ui-test)
- [Conventions](#conventions)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Area | Library | Version |
| --- | --- | --- |
| Test runner | `@playwright/test` | ^1.62.1 |
| BDD runner | `@cucumber/cucumber` | ^13.2.1 |
| TS loader for Cucumber | `ts-node`, `tsconfig-paths` | ^10.9.2 / ^4.2.0 |
| Language | `typescript` | ^7.0.2 |
| Node typings | `@types/node` | ^26.2.0 |
| Test data generation | `@faker-js/faker` | ^10.5.0 |
| JSON schema validation | `ajv`, `ajv-formats` | ^8.20.0 / ^3.0.1 |
| JSON querying | `jsonpath-plus` | ^10.4.0 |
| Reporting | `allure-playwright` | ^3.10.2 |
| CSV test data | `csv-parse` | ^7.0.2 |
| Excel test data | `xlsx` | ^0.18.5 |
| Logging | `winston` | ^3.19.0 |
| Env config | `dotenv` | ^17.4.2 |
| Cross-platform env vars | `cross-env` | ^10.1.0 |

All dependencies are declared as `devDependencies` — this is a test-only project with no runtime shipping artifact. `src/api/` (beyond `BookingApi.ts`) and `rules/` are otherwise still tracked with `.gitkeep`.

---

## Project Structure

```
AdvancedFramework_2x/
├── .github/
│   └── workflows/
│       └── playwright.yml          # CI pipeline (GitHub Actions)
├── docs/                           # Framework docs (e.g. dotenv-support.md, eli5/ explainers)
├── learnings/                      # Study notes (cucumberFramework.md, world.md, …)
├── rules/                          # Framework conventions / coding rules (placeholder)
├── src/
│   ├── cucumber/                   # Cucumber BDD layer (run by cucumber-js, not Playwright Test)
│   │   ├── support/
│   │   │   ├── world.ts                # CustomWorld: browser/context/page + page objects
│   │   │   └── hooks.ts                # BeforeAll/Before/After: launch, per-scenario context, fail screenshot
│   │   ├── level-00-installation/      # features/*.feature + steps/*.ts
│   │   └── tsconfig.json               # CommonJS override for ts-node
│   ├── api/
│   │   └── BookingApi.ts               # Typed client for restful-booker
│   ├── config/
│   │   ├── env.ts                      # Typed process.env reads: env/requireEnv/envFlag/envNumber
│   │   └── credentials.ts              # TTACart login creds, resolved via env()
│   ├── fixtures/
│   │   ├── test-base.ts                # Page-object + state fixtures for TTACart specs
│   │   └── booker-fixture.ts           # bookingApi / bookerToken fixtures for API specs
│   ├── pages/
│   │   ├── BasePage.ts                     # Abstract base: page, el, log, goto()
│   │   ├── LoginPage.ts                    # TTACart login screen
│   │   ├── InventoryPage.ts                # Product listing / add-to-cart
│   │   ├── ItemDetailPage.ts               # Single item detail view
│   │   ├── CartPage.ts                     # Cart contents
│   │   ├── CheckoutStepOnePage.ts          # Customer info form
│   │   ├── CheckoutStepTwoPage.ts          # Order overview
│   │   └── CheckoutCompletePage.ts         # Order confirmation
│   ├── testdata/
│   │   ├── logintestdata.json          # TTACart personas + documented quirks
│   │   ├── checkouttestdata.json       # Checkout-flow fixtures
│   │   └── api-booking-data.ts         # restful-booker request/response fixtures
│   ├── tests/                      # Spec files (testDir)
│   │   ├── login/                      # Login.spec.ts, login-data-driven.spec.ts
│   │   ├── e2e/                        # e2e-checkout_1..4 (fixtures, data-driven, env-driven)
│   │   └── apiTests/                   # 01_restfulbooker_raw .. 04_jsonpath_plus
│   └── utils/
│       ├── UtilElementLocators.ts  # Logged wrappers over Playwright actions
│       ├── logger.ts               # Winston root + scoped child loggers
│       ├── DataGenerator.ts        # Faker-backed test data
│       ├── APIHelper.ts            # Generic HTTP verb wrapper + retry
│       ├── visualStep.ts           # test.step + optional per-step screenshot
│       ├── CustomReporter.ts       # Custom live HTML reporter (registered in config)
│       └── howToUseLogger.md       # Logger usage notes
├── logs/                           # combined.log from Winston (git-ignored)
├── tta-report/                     # Custom live HTML report (git-ignored)
├── .env                            # Local secrets (git-ignored)
├── .env.example                    # Template for .env
├── reports/cucumber/               # Cucumber HTML report (git-ignored)
├── .gitignore
├── cucumber.js                     # Cucumber profiles (default, level0, level1, level2)
├── package.json
├── playwright.config.ts
└── tsconfig.json
```

---

## Layer Architecture

```
spec  →  fixture (test-base)  →  Page Object (extends BasePage)  →  UtilElementLocator  →  Playwright
                                          ↓                                ↓
                                    createLogger(scope) ──────────→ logs/combined.log
```

Specs ask `@fixtures/test-base` for a page object or a pre-built state (e.g. `loginWithSelectedItem`) instead of constructing page objects or repeating login by hand. Page objects never build their own locators outside their constructor and never assert behaviour under test — see [Conventions](#conventions).

---

## Framework Building Blocks

The suite targets **TTACart**, served under `baseURL` at `/playwright/ttacart/*.html`.

### `BasePage` — [src/pages/BasePage.ts](src/pages/BasePage.ts)

Abstract parent for every page object. Its constructor takes `(page, scope)` and gives subclasses:

| Member | What it is |
| --- | --- |
| `page` | The Playwright `Page` handle |
| `el` | A `UtilElementLocator` bound to that page and scope |
| `log` | A scoped Winston logger (`scope` = the subclass name) |
| `goto(relativePath)` | Navigates, then waits for `domcontentloaded` |

The base class deliberately builds **no** locators — every subclass declares its own `private readonly` `Locator` fields, keyed off `[data-test="..."]`, and exposes a `static readonly PATH` plus an `open()`.

### Page Objects — [src/pages/](src/pages/)

| Page Object | `PATH` | Notes |
| --- | --- | --- |
| `LoginPage` | `/playwright/ttacart/index.html` | `loginAs()`, `waitForLoginButtonHidden()`, `expectErrorVisible()`, `expectErrorContains()` |
| `InventoryPage` | `/playwright/ttacart/inventory.html` | Product listing, `addToCart(itemId)`, `assertLoaded()` |
| `ItemDetailPage` | `/playwright/ttacart/inventory-item.html` | Single item view, `assertLoaded(id)` |
| `CartPage` | `/playwright/ttacart/cart.html` | `assertLoaded()` |
| `CheckoutStepOnePage` | `/playwright/ttacart/checkout-step-one.html` | Customer info form, `assertLoaded()`, `expectErrorContains()` |
| `CheckoutStepTwoPage` | `/playwright/ttacart/checkout-step-two.html` | Order overview, `assertLoaded()` |
| `CheckoutCompletePage` | `/playwright/ttacart/checkout-complete.html` | `assertLoaded()`, `assertOrderComplete()` |

Convention: *readiness/precondition* assertions (`assertLoaded`, `expectErrorVisible`) live on the page object; *behaviour under test* assertions live in the spec.

### `UtilElementLocator` — [src/utils/UtilElementLocators.ts](src/utils/UtilElementLocators.ts)

Thin, logged wrappers over the Playwright element API. Every method accepts a `Flex` target (`string | Locator`) and defaults to `DEFAULT_ACTION_TIMEOUT_MS` (15s) — separate from the config's `expect.timeout` (10s). `type()` delegates to `pressSequentially()` since Playwright deprecated `.type()`. Page-object actions route through `this.el.*` rather than calling the locator directly, which is what produces the debug log trail.

### `logger` — [src/utils/logger.ts](src/utils/logger.ts)

Winston logging with two entry points:

- `logger` — the shared root logger.
- `createLogger(scope)` — a child logger tagged with a scope label; page objects pass their class name.

Level comes from `LOG_LEVEL` (default `info`). Output goes to console (colourised) and to `logs/combined.log`.

### `test-base` — [src/fixtures/test-base.ts](src/fixtures/test-base.ts)

Extends Playwright's `test` with two groups of fixtures. Import `test`/`expect` from `@fixtures/test-base`, not `@playwright/test`, in new UI specs.

- **Page-object fixtures** — `loginPage`, `inventoryPage`, `itemDetailPage`, `cartPage`, `checkoutStepOnePage`, `checkoutStepTwoPage`, `checkoutCompletePage`. These only construct; they never navigate.
- **State fixtures** — `validLogin`, `invalidLogin`, `loginWithInventory`, `loginWithSelectedItem`. These perform setup and layer on each other:

  ```
  loginWithSelectedItem → loginWithInventory → validLogin
  ```

  so login happens once per test no matter how deep the chain goes. `invalidLogin` sits deliberately outside that chain. Depend on the nearest fixture rather than logging in again — Playwright builds a fixture only when a test names it, so unused ones cost nothing.

Each state fixture asserts its own precondition before handing over (`validLogin` calls `waitForLoginButtonHidden()`, `invalidLogin` calls `expectErrorVisible()`), so a failed setup fails at the fixture instead of surfacing later at an unrelated step.

```ts
import { test, expect } from '@fixtures/test-base';

test('add to cart', async ({ loginWithInventory: inventoryPage, cartPage }) => {
  await inventoryPage.addToCart('test-allthethings-tshirt-red');
  await cartPage.open();
  await expect(cartPage.rowCount()).resolves.toBe(1);
});
```

### `config/env` and `config/credentials` — [src/config/](src/config/)

`env.ts` exposes typed reads of `process.env`: `env(key, fallback)`, `requireEnv(key)` (throws if absent — for tokens/secrets), `envFlag(key)` (true/1/yes, case-insensitive), `envNumber(key, fallback)`. All treat a blank value as unset, matching `resolveBaseURL()`'s treatment of a blank `BASE_URL`.

`credentials.ts` resolves TTACart's login from `STANDARD_USER` / `TTA_SECRET` (falling back to `standard_user` / `tta_secret`) — deliberately **not** `USERNAME`/`PASSWORD`, since Windows sets `USERNAME` for every process and `dotenv` never overwrites an existing key.

### `DataGenerator` — [src/utils/DataGenerator.ts](src/utils/DataGenerator.ts)

Static, Faker-backed generators for credentials and checkout customer info. `checkoutCustomer()` and `userProfile()` are the composites specs actually use. Faker v10 is ESM-only; it typechecks because `tsconfig.json` uses `module: preserve` / `moduleResolution: bundler`, and resolves at runtime via `require(esm)`, which needs **Node >= 22.12**.

### `visualStep` — [src/utils/visualStep.ts](src/utils/visualStep.ts)

Drop-in replacement for `test.step` that also attaches a step screenshot when `ATTACH_SCREENSHOTS=true` (unset by default — not wired into `.env` or any npm script). Names each attachment `step-<index>-<slugified-title>`; `CustomReporter.ts` matches that prefix against its own per-test step counter to hang the screenshot on the right step in the HTML report. **Use one or the other within a spec** — mixing raw `test.step` with `visualStep` desynchronises the two counters and screenshots land on the wrong step.

### `APIHelper` / `BookingApi` / `booker-fixture` — API layer

- `ApiHelper` ([src/utils/APIHelper.ts](src/utils/APIHelper.ts)) — generic `GET/POST/PUT/PATCH/DELETE` wrapper over `APIRequestContext`, plus `callApiWithRetry()` for polling and `isSuccess()`/`isFailureClient()` status helpers.
- `BookingApi` ([src/api/BookingApi.ts](src/api/BookingApi.ts)) — typed client for restful-booker (auth token, CRUD on bookings).
- `booker-fixture.ts` ([src/fixtures/booker-fixture.ts](src/fixtures/booker-fixture.ts)) — extends `test` with `bookingApi` and `bookerToken` fixtures for API specs.

### `CustomReporter` — [src/utils/CustomReporter.ts](src/utils/CustomReporter.ts)

A self-contained Playwright reporter (`CustomTTAReporter`) that writes a live, self-refreshing HTML report into `tta-report/`:

- `tta-report/report_<YYYYMMDD_HHMMSS>.html` — the run's report, rewritten after every step.
- `tta-report/index.html` — redirect to the latest run.
- `tta-report/history.html` — index of past runs.
- Copies of screenshots, videos and traces under `tta-report/screenshots|videos|traces/`.

It groups tests by file and `describe` path, associates console logs and step screenshots with individual `test.step()`/`visualStep()` calls, and records video offsets per step. `TEST_ENV` and `TEST_AUTHOR` populate the report's environment/author columns. Registered by default in [playwright.config.ts](playwright.config.ts):

```ts
reporter: [
  ['html'],
  ['list'],
  ['./src/utils/CustomReporter.ts'],
],
```

Remove that third entry to turn it off.

---

## Prerequisites

- **Node.js >= 22.12** — `@faker-js/faker` v10 is ESM-only and loaded through `require(esm)`, which older Node lines do not support. CI runs `lts/*`.
- **npm** (bundled with Node)
- Git

---

## Installation

```bash
git clone https://github.com/bhagya554/AdvancePlaywrightFramework2x.git
cd AdvancePlaywrightFramework2x
npm install
npx playwright install --with-deps
```

`npx playwright install` downloads the browser binaries; `--with-deps` also installs OS-level dependencies (required on Linux/CI, optional on Windows).

---

## Environment Configuration

Copy the template and fill in real values:

```bash
cp .env.example .env
```

`.env` is git-ignored (`.env` and `.env.*` are excluded, with `!.env.example` re-included). **Never commit real credentials.** `.env` is loaded by bare `dotenv.config()` at the top of `playwright.config.ts` — CWD-relative, so tests must be run from the project root.

Supported variables:

| Variable | Purpose |
| --- | --- |
| `ENV` | Logical environment label |
| `TTA_ENV` | Selects the base URL branch (`qa`, `dev`/`local`, `stg`/`stage`/`staging`, `prod`/`production`, `api`) |
| `BASE_URL` | Explicit override — wins over every other resolution rule |
| `QA_BASE_URL` | QA base URL (default `https://app.thetestingacademy.com`) |
| `DEV_BASE_URL` | Dev/local base URL (default `http://localhost:3000`) |
| `STG_BASE_URL` | Staging base URL (default `https://stage.thetestingacademy.com`) |
| `PROD_BASE_URL` | Production base URL (default `https://app.thetestingacademy.com`) |
| `API_BASE_URL` | API base URL (default `https://restful-booker.herokuapp.com`) |
| `STANDARD_USER` / `TTA_SECRET` | TTACart login, read by `src/config/credentials.ts`. **Not** `USERNAME`/`PASSWORD` — Windows sets `USERNAME` for every process and `dotenv` never overwrites an existing key |
| `TTA_ITEM_ID` | Product under test for the env-driven checkout spec (default `test-allthethings-tshirt-red`) |
| `API_TOKEN` | Bearer/API token for API tests |
| `ATTACH_SCREENSHOTS` | `true`/`1`/`yes` enables `visualStep()` per-step screenshots (default off) |
| `LOG_LEVEL` | Winston level for `src/utils/logger.ts` (default `info`) |
| `TEST_ENV` | Environment label shown in the custom HTML report (default `UAT`) |
| `TEST_AUTHOR` | Author column in the custom HTML report (default `TTA-QA`) |

### Base URL resolution order

`resolveBaseURL()` in [playwright.config.ts](playwright.config.ts) applies this precedence:

1. `BASE_URL`, if set — returned immediately.
2. Otherwise `TTA_ENV` (lower-cased, defaulting to `qa`) selects the matching `*_BASE_URL` variable.
3. Otherwise the hard-coded default for that environment is used.

> **Important:** because `BASE_URL` short-circuits the whole function, a `BASE_URL` line in your `.env` pins every run to that one host and makes `TTA_ENV` a no-op. Leave `BASE_URL` blank in `.env` unless you deliberately want that pin. The committed `.env.example` ships `BASE_URL=https://example.com` as an illustration of that same trap.

### Switching environments

Use the per-environment npm scripts — they work identically on Windows, macOS, and Linux via `cross-env`:

```bash
npm run test:qa      # TTA_ENV=qa
npm run test:dev     # TTA_ENV=dev
npm run test:stg     # TTA_ENV=stg
npm run test:prod    # TTA_ENV=prod
npm run test:api     # TTA_ENV=api — restful-booker, not a separate Playwright project
```

Each script blanks `BASE_URL` first (`cross-env BASE_URL= TTA_ENV=... playwright test`) so the `.env` pin cannot override the environment you asked for — this blank is load-bearing, never drop it when adding a new env script. An empty string is falsy, so `resolveBaseURL()` skips the override branch; `dotenv` will not refill an already-present key.

Adding a new environment means touching three places: the `switch` in `resolveBaseURL()`, `.env.example`, and a new `test:<env>` script in `package.json`.

---

## Running Tests

| Task | npm script | Direct command |
| --- | --- | --- |
| Run all tests | `npm test` | `npx playwright test` |
| Headed mode | `npm run test:headed` | `npx playwright test --headed` |
| UI mode | `npm run test:ui` | `npx playwright test --ui` |
| Debug (inspector) | `npm run test:debug` | `npx playwright test --debug` |
| Run with Allure reporter | `npm run test:allure` | `npx playwright test --reporter=list,allure-playwright` |
| Run against qa / dev / stg / prod / api | `npm run test:qa` (also `:dev`, `:stg`, `:prod`, `:api`) | `npx cross-env BASE_URL= TTA_ENV=qa playwright test` |
| Open last HTML report | `npm run report` | `npx playwright show-report` |
| Codegen (record) | `npm run codegen -- https://example.com` | `npx playwright codegen https://example.com` |
| Type-check only | `npm run typecheck` | `npx tsc --noEmit` |
| Install browsers | `npm run install:browsers` | `npx playwright install --with-deps` |

No linter is configured — `npm run typecheck` is the whole static-check gate.

Pass extra Playwright arguments after `--`:

```bash
npm test -- src/tests/e2e/e2e-checkout_1.spec.ts   # single spec
npm test -- -g "@P0"                               # filter by title / tag
npm test -- --workers=1                            # force serial execution
```

### Current suites

| Path | Covers |
| --- | --- |
| `src/tests/login/Login.spec.ts` | TTACart login — raw `@playwright/test`, manual `new LoginPage(page)` |
| `src/tests/login/login-data-driven.spec.ts` | Login against `logintestdata.json` personas |
| `src/tests/e2e/e2e-checkout_1.spec.ts` | End-to-end checkout via fixture-style `@fixtures/test-base` |
| `src/tests/e2e/e2e-checkout_2-data-driven.spec.ts` | Checkout against `checkouttestdata.json` |
| `src/tests/e2e/e2e-checkout_3-MoreFixtureUsage.spec.ts` | Deeper state-fixture chaining |
| `src/tests/e2e/e2e-checkout_4-env.spec.ts` | Checkout driven by `TTA_ITEM_ID` |
| `src/tests/apiTests/01_restfulbooker_raw/*` | restful-booker via raw `request` context (ping, POST, new context, PUT, full CRUD) |
| `src/tests/apiTests/02_restfulbooker_apiHelper/*` | Same API, routed through `ApiHelper` |
| `src/tests/apiTests/03_restfulbooker_fixture_e2e_api/*` | Same API, routed through `booker-fixture` (`bookingApi`/`bookerToken`) |
| `src/tests/apiTests/04_jsonpath_plus/jsonpath-queries.e2e.spec.ts` | `jsonpath-plus` queries over API responses |

Two import styles coexist: `e2e-checkout_1.spec.ts` uses the fixture base (`@fixtures/test-base`); `Login.spec.ts` still does raw `@playwright/test` + manual construction. Prefer the fixture style for new specs.

`testDir` is `./src/tests` — specs outside that tree are invisible to the runner regardless of subfolder depth.

### Cucumber (BDD)

Gherkin scenarios under `src/cucumber/` run through `cucumber-js`, separately from Playwright Test. Playwright is used only as the browser library; `hooks.ts` launches Chromium once per run and gives each scenario a fresh context and page on `CustomWorld`.

```bash
npx cucumber-js                     # default profile: every feature under src/cucumber
npx cucumber-js --profile level0    # just level-00-installation
npx cucumber-js --tags @smoke       # filter by tag
HEADED=1 npx cucumber-js            # show the browser
```

- Profiles live in [cucumber.js](cucumber.js). `level1` / `level2` are declared ahead of their folders, which don't exist yet.
- TypeScript is loaded by `ts-node` using [src/cucumber/tsconfig.json](src/cucumber/tsconfig.json) (CommonJS), with `tsconfig-paths` resolving the `@pages/*` / `@utils/*` aliases.
- The base URL comes from `BASE_URL`, falling back to `https://app.thetestingacademy.com`. `TTA_ENV` is **not** consulted here.
- Report: `reports/cucumber/report.html`. On failure, a screenshot is attached to the scenario.
- There's no npm script for Cucumber yet. Walkthroughs are in [learnings/cucumberFramework.md](learnings/cucumberFramework.md), [learnings/world.md](learnings/world.md) and [docs/eli5/cucumber-flow.html](docs/eli5/cucumber-flow.html).

---

## Reports and Artifacts

- **HTML report** — written to `playwright-report/`, opened with `npx playwright show-report`.
- **List reporter** — live per-test output in the terminal.
- **Screenshots** — `only-on-failure` (Playwright's automatic capture — independent of `ATTACH_SCREENSHOTS`/`visualStep`, which is per-step).
- **Video** — recorded `on` (every test).
- **Trace** — captured `on` (every test, not just failures/retries); view with `npx playwright show-trace <trace.zip>`.
- **Logs** — `logs/combined.log`, written by Winston on every run.

Raw artifacts land in `test-results/`. `test-results/`, `playwright-report/`, `tta-report/` and `logs/` are all git-ignored, and grow fast locally — more so with `ATTACH_SCREENSHOTS=true`.

### Custom TTA report

[src/utils/CustomReporter.ts](src/utils/CustomReporter.ts) is in the `reporter` array, so every run writes a live HTML report under `tta-report/`. Open `tta-report/index.html` for the latest run or `tta-report/history.html` for previous ones. Videos and traces are copied in for each test; step screenshots appear only when `ATTACH_SCREENSHOTS=true` and only for specs that use `visualStep()` (see [visualStep contract](#visualstep--srcutilsvisualstepts)).

### Allure

`npm run test:allure` runs the suite with the `allure-playwright` reporter and writes raw results to `allure-results/`. Rendering them into a browsable report needs the **Allure CLI**, which is **not** a project dependency — install it separately:

```bash
npm i -g allure-commandline
allure serve allure-results
```

To make Allure the default, add `['allure-playwright']` to the `reporter` array in [playwright.config.ts](playwright.config.ts). Both `allure-results/` and `allure-report/` are git-ignored.

---

## Playwright Configuration

Key settings in [playwright.config.ts](playwright.config.ts):

| Setting | Value | Notes |
| --- | --- | --- |
| `testDir` | `./src/tests` | Only this tree is scanned for specs |
| `timeout` | `60_000` ms | Per-test budget |
| `expect.timeout` | `10_000` ms | Per-assertion budget |
| `fullyParallel` | `true` | Tests inside a file run in parallel |
| `retries` | `2` on CI, `0` locally | Driven by the `CI` env var |
| `forbidOnly` / CI `workers: 1` | commented out | A stray `test.only` will **not** fail CI as-is |
| `reporter` | `html`, `list`, `CustomReporter.ts` | |
| `use.baseURL` | `resolveBaseURL()` | See [resolution order](#base-url-resolution-order) |
| `use.screenshot` | `only-on-failure` | |
| `use.video` | `on` | Every test |
| `use.trace` | `on` | Every test, not just retries |
| `use.headless` | `false` | Browser runs headed by default locally |
| `projects` | `chromium` (`testDir: ./src/tests`), `api` (`testDir: ./src/api`) | The `api` project currently has no specs under `src/api/` — the implemented API suites live under `src/tests/apiTests/` and are exercised via the `chromium` project, selected by `TTA_ENV=api` |

---

## TypeScript Configuration

From [tsconfig.json](tsconfig.json):

- Target `ES2022`, `module: preserve`, `moduleResolution: bundler`, libs `ES2022` + `DOM`
  (`preserve`/`bundler` — not `Node16` — specifically so ESM-only Faker v10 typechecks)
- `strict: true`, `noEmit: true` (Playwright transpiles at run time — no build step exists)
- `esModuleInterop`, `allowSyntheticDefaultImports`, `resolveJsonModule`, `skipLibCheck`, `forceConsistentCasingInFileNames`
- Path aliases: `@src/* @api/* @config/* @fixtures/* @pages/* @testdata/* @utils/*` — Playwright resolves tsconfig paths natively, so they work at runtime as well as typecheck. Existing code mixes e.g. `@src/utils/logger` and `@utils/logger` — both resolve.
- Includes `src/**/*.ts` and `playwright.config.ts`; excludes `node_modules`, `test-results`, `playwright-report`

---

## Continuous Integration

[.github/workflows/playwright.yml](.github/workflows/playwright.yml) runs on push and pull request against `main` and `master`:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: lts/*`
3. `npm ci`
4. `npx playwright install --with-deps`
5. `npx playwright test`
6. Upload `playwright-report/` as an artifact (30-day retention), even when a step fails

The job timeout is 60 minutes. Because `npm ci` is used, `package-lock.json` must stay committed and in sync with `package.json`.

The workflow has **no `env:` block**, so nothing from `.env` reaches CI — `TTA_ENV`, `LOG_LEVEL`, `ATTACH_SCREENSHOTS` and any credentials need mapping there from repository secrets before CI can drive anything but the hard-coded QA default headlessly.

---

## Writing a New UI Test

1. Add the page object under `src/pages/`, extending `BasePage` (locators + actions in the constructor, no behaviour-under-test assertions).
2. Register it as a fixture in `src/fixtures/test-base.ts` if other specs will reuse it or its setup.
3. Put static data in `src/testdata/` (JSON/CSV/XLSX) or generate it with `DataGenerator`.
4. Create the spec in `src/tests/<area>/` as `<feature>.spec.ts`, importing `test`/`expect` from `@fixtures/test-base`.
5. Navigate through the page object's own `goto()`/`open()` so `baseURL` stays environment-driven — never hard-code a URL in a spec.
6. Wrap each phase in `test.step()` (or `visualStep()`, not both in the same spec) so the custom report shows each phase separately.

```ts
import { test, expect } from '@fixtures/test-base';
import { DataGenerator } from '@utils/DataGenerator';

test('rejects unknown credentials', async ({ loginPage }) => {
  await test.step('Open the TTACart login page', async () => {
    await loginPage.open();
  });

  await test.step('Submit generated credentials', async () => {
    const { username, password } = DataGenerator.credentials();
    await loginPage.loginAs(username, password);
  });

  await test.step('Verify the error banner is shown', async () => {
    await loginPage.expectErrorVisible();
  });
});
```

Imports use the `@fixtures/*`, `@pages/*`, `@utils/*` … aliases; Playwright resolves tsconfig paths at run time, so no build step is involved.

---

## Conventions

- Specs live only in `src/tests/` and end with `.spec.ts`.
- Prefer `@fixtures/test-base` over raw `@playwright/test` + manual page-object construction in new specs.
- Depend on the nearest layered state fixture (e.g. `loginWithSelectedItem`) rather than repeating login/setup.
- Page objects hold *readiness/precondition* assertions (`assertLoaded()`, `expectErrorVisible()`); *behaviour under test* assertions belong in the spec.
- Locators are CSS `[data-test="..."]` strings, matching how TTACart marks its elements — not `getByRole`/`getByLabel`.
- Route page-object actions through `this.el.*` (`UtilElementLocator`), not the raw `Locator` API, to keep the debug log trail intact.
- Use Playwright's web-first assertions (`await expect(...)`) instead of manual waits or `waitForTimeout`.
- Never hard-code environments, URLs, or credentials in specs — read them from `src/config/` or navigate via a page object's `open()`.
- Keep tests independent and parallel-safe; `fullyParallel` is enabled.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `browserType.launch: Executable doesn't exist` | Run `npx playwright install` |
| Tests hit the wrong host | `BASE_URL` in `.env` overrides `TTA_ENV`. Blank it, or use `npm run test:stg` (etc.), which blanks it for you |
| `.env` values ignored | Confirm `.env` sits in the project root; it is loaded by `dotenv.config()` in `playwright.config.ts`, which is CWD-relative |
| Login always fails locally | Check `.env` uses `STANDARD_USER`/`TTA_SECRET`, not `USERNAME`/`PASSWORD` — Windows already sets `USERNAME`, so that line is silently ignored |
| `npm ci` fails in CI | Regenerate and commit `package-lock.json` (`npm install`) |
| Flaky selectors | Follow the existing `[data-test="..."]` convention rather than text/XPath selectors |
| Report not opening | Run `npx playwright show-report` from the project root |
| `ERR_REQUIRE_ESM` from `@faker-js/faker` | Node is older than 22.12 — upgrade Node |
| `No tests found` | Specs outside `testDir` (`src/tests/`) are invisible to the runner; check the file ends with `.spec.ts` |
| No `tta-report/` produced | Check `CustomReporter.ts` is still in the `reporter` array in `playwright.config.ts` |
| No step screenshots in the report | `ATTACH_SCREENSHOTS` isn't set anywhere by default — export `ATTACH_SCREENSHOTS=true` and use `visualStep()`, not raw `test.step()`, in that spec |
| Step screenshots land on the wrong step | A spec mixes raw `test.step()` and `visualStep()` — their counters drift out of sync. Use only one per spec |
| Logs missing | Raise the level with `LOG_LEVEL=debug`; file output goes to `logs/combined.log` |

---

## Repository

https://github.com/bhagya554/AdvancePlaywrightFramework2x
