# Advanced Playwright Framework 2.x

A TypeScript-based UI and API test automation framework built on [Playwright Test](https://playwright.dev/). It is structured for the Page Object Model, environment-driven configuration, data-driven testing, and CI execution through GitHub Actions.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
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
│   ├── testdata/               # JSON / CSV / XLSX test data
│   ├── tests/                  # Spec files (testDir)
│   │   └── example.spec.ts
│   └── utils/                  # Logger, helpers, data readers
├── .env                        # Local secrets (git-ignored)
├── .env.example                # Template for .env
├── .gitignore
├── package.json
├── playwright.config.ts
└── tsconfig.json
```

Empty folders are tracked with `.gitkeep` so the layout survives a fresh clone.

---

## Prerequisites

- **Node.js** LTS (18+; CI runs `lts/*`)
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

### Base URL resolution order

`resolveBaseURL()` in [playwright.config.ts](playwright.config.ts) applies this precedence:

1. `BASE_URL`, if set — returned immediately.
2. Otherwise `TTA_ENV` (lower-cased, defaulting to `qa`) selects the matching `*_BASE_URL` variable.
3. Otherwise the hard-coded default for that environment is used.

Example — run the suite against staging:

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

Raw artifacts land in `test-results/`. Both `test-results/` and `playwright-report/` are git-ignored.

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

- Target `ES2022`, module + resolution `Node16`, libs `ES2022` + `DOM`
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

1. Add the page object under `src/pages/` (locators + actions, no assertions).
2. Add fixtures under `src/fixtures/` if the test needs shared setup.
3. Put static data in `src/testdata/` (JSON/CSV/XLSX) or generate it with `@faker-js/faker`.
4. Create the spec in `src/tests/` as `<feature>.spec.ts`.
5. Use relative paths in `page.goto('/...')` so `baseURL` stays environment-driven.

```ts
import { test, expect } from '@playwright/test';

test('get started link', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Playwright/);
});
```

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
| Tests hit the wrong host | Check `BASE_URL` / `TTA_ENV` — `BASE_URL` overrides everything |
| `.env` values ignored | Confirm `.env` sits in the project root; it is loaded by `dotenv.config()` in `playwright.config.ts` |
| `npm ci` fails in CI | Regenerate and commit `package-lock.json` (`npm install`) |
| Flaky selectors | Switch to role/label/test-id locators and web-first assertions |
| Report not opening | Run `npx playwright show-report` from the project root |

---

## Repository

https://github.com/bhagya554/AdvancePlaywrightFramework2x
