# Advanced Playwright Framework 2.x

A TypeScript-based UI and API test automation framework built on [Playwright Test](https://playwright.dev/). It is structured for the Page Object Model, environment-driven configuration, data-driven testing, and CI execution through GitHub Actions.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Framework Building Blocks](#framework-building-blocks)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running Tests](#running-tests)
- [Reports and Artifacts](#reports-and-artifacts)
- [Playwright Configuration](#playwright-configuration)
- [TypeScript Configuration](#typescript-configuration)
- [Continuous Integration](#continuous-integration)
- [Writing a New Test](#writing-a-new-test)
- [Conventions](#conventions)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Area | Library | Version |
| --- | --- | --- |
| Test runner | `@playwright/test` | ^1.62.1 |
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

All dependencies are declared as `devDependencies` — this is a test-only project with no runtime shipping artifact.

---

## Project Structure

```
AdvancedFramework_2x/
├── .github/
│   └── workflows/
│       └── playwright.yml      # CI pipeline (GitHub Actions)
├── docs/                       # Framework and test documentation
├── rules/                      # Framework conventions / coding rules
├── src/
│   ├── api/                    # API clients and request helpers
│   ├── config/                 # Environment and config resolution
│   ├── fixtures/               # Custom Playwright fixtures
│   ├── pages/                  # Page Object Model classes
│   │   ├── BasePage.ts             # Abstract base: page, el, log, goto()
│   │   ├── LoginPage.ts            # TTACart login screen
│   │   ├── InventoryPage.ts        # (placeholder)
│   │   ├── ItemDetailsPage.ts      # (placeholder)
│   │   ├── CartPage.ts             # (placeholder)
│   │   ├── CheckoutStepOnePage.ts  # (placeholder)
│   │   ├── CheckoutStepTwoPage.ts  # (placeholder)
│   │   └── CheckoutCompletePage.ts # (placeholder)
│   ├── testdata/               # JSON / CSV / XLSX test data
│   ├── tests/                  # Spec files (testDir)
│   └── utils/
│       ├── UtilElementLocators.ts  # Logged wrappers over Playwright actions
│       ├── logger.ts               # Winston root + scoped child loggers
│       ├── DataGenerator.ts        # Faker-backed test data
│       └── CustomReporter.ts       # Custom live HTML reporter (opt-in)
├── logs/                       # combined.log from Winston (git-ignored)
├── .env                        # Local secrets (git-ignored)
├── .env.example                # Template for .env
├── .gitignore
├── package.json
├── playwright.config.ts
└── tsconfig.json
```

Empty folders are tracked with `.gitkeep` so the layout survives a fresh clone. The page objects marked *(placeholder)* exist as empty files and are still to be implemented; `src/tests/` currently holds no specs, so `npx playwright test` reports zero tests until you add one.

---

## Framework Building Blocks

The suite targets **TTACart**, a SauceDemo-style storefront served under the configured `baseURL` (`/playwright/ttacart/index.html`).

### `BasePage` — [src/pages/BasePage.ts](src/pages/BasePage.ts)

Abstract parent for every page object. Its constructor takes `(page, scope)` and gives subclasses three protected members plus one helper:

| Member | What it is |
| --- | --- |
| `page` | The Playwright `Page` handle |
| `el` | A `UtilElementLocator` bound to that page and scope |
| `log` | A scoped Winston logger (`scope` = the subclass name) |
| `goto(relativePath)` | Navigates, then waits for `domcontentloaded` |

The base class deliberately builds **no** locators — subclasses declare their own `private readonly` `Locator` fields.

```ts
export class LoginPage extends BasePage {
  static readonly PATH = '/playwright/ttacart/index.html';

  private readonly usernameInput: Locator;

  constructor(page: Page) {
    super(page, 'LoginPage');
    this.usernameInput = page.locator("[data-test='username']");
  }
}
```

### `UtilElementLocator` — [src/utils/UtilElementLocators.ts](src/utils/UtilElementLocators.ts)

Thin, logged wrappers over the Playwright element API. Every method accepts a `Flex` target — either a CSS string or an already-built `Locator` — and defaults to a `15_000` ms action timeout (`DEFAULT_ACTION_TIMEOUT_MS`).

| Group | Methods |
| --- | --- |
| Mouse | `click`, `doubleClick`, `rightClick`, `hover` |
| Input | `fill`, `type`, `pressSequencially`, `clear` |
| Content | `getText`, `getInnerText`, `getAllTexts`, `getAttribute`, `getValue`, `count` |
| State | `isVisible`, `isEnabled`, `isChecked` |
| Waits | `waitForVisible`, `waitForHidden`, `waitForPageLoad` |
| Select | `selectByText`, `selectByIndex`, `selectByValue` |

`type()` is kept as a public name for familiarity but delegates to `pressSequentially()`, since Playwright deprecated `.type()`. `waitForPageLoad()` waits for `domcontentloaded`, then attempts `networkidle` and swallows the timeout.

### `logger` — [src/utils/logger.ts](src/utils/logger.ts)

Winston logging with two entry points:

- `logger` — the shared root logger for framework-wide messages.
- `createLogger(scope)` — a child logger tagged with a scope label; page objects pass their class name.

Level comes from `LOG_LEVEL` (default `info`). Output goes to the console (colourised) and to `logs/combined.log`, so CI runs leave an artifact behind. Line format:

```
2026-06-02 07:40:01 [info] [LoginPage] Login As: standard_user
```

### `DataGenerator` — [src/utils/DataGenerator.ts](src/utils/DataGenerator.ts)

Static, Faker-backed generators for the data TTACart needs — credentials and checkout customer info.

| Category | Methods |
| --- | --- |
| Credentials | `username()`, `customUsername(first, last)`, `password(length = 12)`, `credentials()` |
| Contact | `firstName()`, `lastName()`, `postalCode()`, `email()`, `customEmail(first, last)`, `phone()` |
| Composites | `checkoutCustomer()`, `userProfile()` |

Exported types: `Credentials`, `CheckoutCustomer`, `UserProfile`.

Faker v10 is ESM-only. It typechecks because `tsconfig.json` uses `module: preserve` / `moduleResolution: bundler`, and it resolves at run time via `require(esm)`, which needs **Node >= 22.12**.

### `CustomReporter` — [src/utils/CustomReporter.ts](src/utils/CustomReporter.ts)

A self-contained Playwright reporter (`CustomTTAReporter`) that writes a live, self-refreshing HTML report into `tta-report/`:

- `tta-report/report_<YYYYMMDD_HHMMSS>.html` — the run's report, rewritten after every step so it can be watched while the suite runs.
- `tta-report/index.html` — redirect to the latest run.
- `tta-report/history.html` — index of past runs.
- Copies of screenshots, videos and traces under `tta-report/screenshots|videos|traces/`.

It also prints a boxed console summary, groups tests by file and `describe` path, associates console logs and screenshots with individual `test.step()` calls, and records video offsets per step. `TEST_ENV` and `TEST_AUTHOR` populate the report's environment and author columns.

It is **not registered by default**. To use it, add it to the `reporter` array in [playwright.config.ts](playwright.config.ts):

```ts
reporter: [
  ['html'],
  ['list'],
  ['./src/utils/CustomReporter.ts'],
],
```

---

## Prerequisites

- **Node.js >= 22.12** — `@faker-js/faker` v10 is ESM-only and is loaded through `require(esm)`, which older Node lines do not support. CI runs `lts/*`.
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

`.env` is git-ignored (`.env` and `.env.*` are excluded, with `!.env.example` re-included). **Never commit real credentials.**

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
| `USER_NAME` | Login user |
| `PASSWORD` | Login password |
| `API_TOKEN` | Bearer/API token for API tests |
| `LOG_LEVEL` | Winston level for `src/utils/logger.ts` (default `info`) |
| `TEST_ENV` | Environment label shown in the custom HTML report (default `UAT`) |
| `TEST_AUTHOR` | Author column in the custom HTML report (default `TTA-QA`) |

### Base URL resolution order

`resolveBaseURL()` in [playwright.config.ts](playwright.config.ts) applies this precedence:

1. `BASE_URL`, if set — returned immediately.
2. Otherwise `TTA_ENV` (lower-cased, defaulting to `qa`) selects the matching `*_BASE_URL` variable.
3. Otherwise the hard-coded default for that environment is used.

> **Important:** because `BASE_URL` short-circuits the whole function, a `BASE_URL` line in your `.env` pins every run to that one host and makes `TTA_ENV` a no-op. Leave `BASE_URL` blank in `.env` unless you deliberately want that pin.

### Switching environments

Use the per-environment npm scripts — they work identically on Windows, macOS, and Linux via `cross-env`:

```bash
npm run test:qa      # TTA_ENV=qa
npm run test:dev     # TTA_ENV=dev
npm run test:stg     # TTA_ENV=stg
npm run test:prod    # TTA_ENV=prod
npm run test:api     # TTA_ENV=api
```

Each script blanks `BASE_URL` first (`cross-env BASE_URL= TTA_ENV=... playwright test`) so the `.env` pin cannot override the environment you asked for. An empty string is falsy, so `resolveBaseURL()` skips the override branch; `dotenv` will not refill an already-present key.

Setting it by hand instead is shell-specific:

```bash
# macOS / Linux
TTA_ENV=staging npx playwright test

# Windows PowerShell
$env:TTA_ENV = "staging"; npx playwright test
```

---

## Running Tests

| Task | npm script | Direct command |
| --- | --- | --- |
| Run all tests | `npm test` | `npx playwright test` |
| Headed mode | `npm run test:headed` | `npx playwright test --headed` |
| UI mode | `npm run test:ui` | `npx playwright test --ui` |
| Debug (inspector) | `npm run test:debug` | `npx playwright test --debug` |
| Run with Allure reporter | `npm run test:allure` | `npx playwright test --reporter=list,allure-playwright` |
| Run against QA / dev / stg / prod / api | `npm run test:qa` (also `:dev`, `:stg`, `:prod`, `:api`) | `npx cross-env BASE_URL= TTA_ENV=qa playwright test` |
| Open last HTML report | `npm run report` | `npx playwright show-report` |
| Codegen (record) | `npm run codegen -- https://example.com` | `npx playwright codegen https://example.com` |
| Type-check only | `npm run typecheck` | `npx tsc --noEmit` |
| Install browsers | `npm run install:browsers` | `npx playwright install --with-deps` |

Pass extra Playwright arguments after `--`:

```bash
npm test -- src/tests/example.spec.ts     # single spec
npm test -- -g "has title"                # filter by test title
npm test -- --workers=1                   # force serial execution
```

---

## Reports and Artifacts

- **HTML report** — written to `playwright-report/`, opened with `npx playwright show-report`.
- **List reporter** — live per-test output in the terminal.
- **Screenshots** — captured `only-on-failure`.
- **Video** — recorded `on` (every test).
- **Trace** — captured `on-first-retry`; view with `npx playwright show-trace <trace.zip>`.

- **Logs** — `logs/combined.log`, written by Winston on every run.

Raw artifacts land in `test-results/`. `test-results/`, `playwright-report/`, `tta-report/` and `logs/` are all git-ignored.

### Custom TTA report

Registering [src/utils/CustomReporter.ts](src/utils/CustomReporter.ts) in the `reporter` array (see [Framework Building Blocks](#framework-building-blocks)) adds a live HTML report under `tta-report/`, refreshed every 5 seconds while the run is in progress. Open `tta-report/index.html` for the latest run or `tta-report/history.html` for previous ones.

### Allure

`npm run test:allure` runs the suite with the `allure-playwright` reporter and writes raw results to `allure-results/`. Rendering them into a browsable report needs the **Allure CLI**, which is not a project dependency — install it separately:

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
| `reporter` | `html`, `list` | |
| `use.baseURL` | `resolveBaseURL()` | See resolution order above |
| `use.screenshot` | `only-on-failure` | |
| `use.video` | `on` | |
| `use.trace` | `on-first-retry` | |
| `projects` | `chromium` (Desktop Chrome) | Add Firefox/WebKit projects as needed |

`forbidOnly` and the CI `workers` override are present but commented out — uncomment them to fail CI on a stray `test.only` and to force serial execution.

---

## TypeScript Configuration

From [tsconfig.json](tsconfig.json):

- Target `ES2022`, `module: preserve`, `moduleResolution: bundler`, libs `ES2022` + `DOM`
  (`preserve`/`bundler` — not `Node16` — so ESM-only packages like Faker v10 typecheck)
- `strict: true`, `noEmit: true` (Playwright transpiles at run time)
- `esModuleInterop`, `allowSyntheticDefaultImports`, `resolveJsonModule`, `skipLibCheck`, `forceConsistentCasingInFileNames`
- Path alias `@src/*` → `./src/*`
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

Secrets used by tests should be added as GitHub repository secrets and mapped to the workflow's `env` block — the `.env` file is never committed.

---

## Writing a New Test

1. Add the page object under `src/pages/`, extending `BasePage` (locators + actions, no assertions).
2. Add fixtures under `src/fixtures/` if the test needs shared setup.
3. Put static data in `src/testdata/` (JSON/CSV/XLSX) or generate it with `DataGenerator`.
4. Create the spec in `src/tests/` as `<feature>.spec.ts`.
5. Navigate through the page object's own `goto()`/`open()` so `baseURL` stays environment-driven.

```ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '@src/pages/LoginPage';
import { DataGenerator } from '@src/utils/DataGenerator';

test('rejects unknown credentials', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();

  const { username, password } = DataGenerator.credentials();
  await login.loginAs(username, password);

  await expect(page.locator('[data-test="error"]')).toBeVisible();
});
```

Imports use the `@src/*` alias; Playwright resolves the tsconfig paths at run time, so no build step is involved.

---

## Conventions

- Specs live only in `src/tests/` and end with `.spec.ts`.
- Page objects expose intent-revealing methods; assertions belong in specs.
- Prefer user-facing locators (`getByRole`, `getByLabel`, `getByTestId`) over CSS/XPath.
- Use Playwright's web-first assertions (`await expect(...)`) instead of manual waits or `waitForTimeout`.
- Never hard-code environments, URLs, or credentials in specs — read them from config/env.
- Keep tests independent and parallel-safe; `fullyParallel` is enabled.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `browserType.launch: Executable doesn't exist` | Run `npx playwright install` |
| Tests hit the wrong host | `BASE_URL` in `.env` overrides `TTA_ENV`. Blank it, or use `npm run test:stg` (etc.), which blanks it for you |
| `.env` values ignored | Confirm `.env` sits in the project root; it is loaded by `dotenv.config()` in `playwright.config.ts` |
| `npm ci` fails in CI | Regenerate and commit `package-lock.json` (`npm install`) |
| Flaky selectors | Switch to role/label/test-id locators and web-first assertions |
| Report not opening | Run `npx playwright show-report` from the project root |
| `ERR_REQUIRE_ESM` from `@faker-js/faker` | Node is older than 22.12 — upgrade Node |
| `No tests found` | `src/tests/` is empty; specs outside `testDir` are invisible to the runner |
| No `tta-report/` produced | `CustomReporter.ts` is opt-in — add it to the `reporter` array in `playwright.config.ts` |
| Logs missing | Raise the level with `LOG_LEVEL=debug`; file output goes to `logs/combined.log` |

---

## Repository

https://github.com/bhagya554/AdvancePlaywrightFramework2x
