# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TypeScript UI + API test automation framework on Playwright Test. Test-only project — every dependency is a `devDependency`, nothing ships. Currently a **scaffold**: `src/api/`, `src/config/`, `src/fixtures/`, `src/pages/`, `src/testdata/`, `src/utils/` and `rules/` are all empty (`.gitkeep` placeholders). Only real spec is [src/tests/example.spec.ts](src/tests/example.spec.ts). Expect to create these layers, not modify them.

## Commands

```bash
npm test                              # all tests
npm test -- src/tests/example.spec.ts # single spec
npm test -- -g "has title"            # single test by title
npm test -- --workers=1               # serial
npm run test:headed / test:ui / test:debug
npm run typecheck                     # tsc --noEmit — no build step exists; this is the only static check
npm run report                        # open last HTML report
npm run install:browsers              # required after fresh clone
npm run codegen -- https://example.com
```

No linter configured. `npm run typecheck` is the whole gate.

Environment scripts: `npm run test:qa | test:dev | test:stg | test:prod | test:api`. Each is `cross-env BASE_URL= TTA_ENV=<env> playwright test` — the blank `BASE_URL=` is load-bearing (see below), so **never** drop it when adding a new env script.

## baseURL resolution — main gotcha

`resolveBaseURL()` in [playwright.config.ts:6](playwright.config.ts#L6) returns `process.env.BASE_URL` immediately if truthy, so a `BASE_URL` line in `.env` silently pins every run to one host and makes `TTA_ENV` dead. **The committed [.env.example](.env.example) ships `BASE_URL=https://example.com`** — anyone who copies it verbatim gets that pin. Blank it in `.env`.

Precedence: `BASE_URL` → `TTA_ENV` (default `qa`) selecting `QA_/DEV_/STG_/PROD_/API_BASE_URL` → hard-coded default per env. Aliases: `dev|local`, `stg|stage|staging`, `prod|production`, `api` (points at `restful-booker.herokuapp.com`, i.e. API suites are just a `TTA_ENV` value, not a separate Playwright project).

Adding a new environment means touching three places: the `switch` in `resolveBaseURL()`, `.env.example`, and a `test:<env>` script in [package.json](package.json).

`.env` is loaded by bare `dotenv.config()` at config top-level — CWD-relative, so tests must be run from the project root.

## Config facts worth knowing

- `testDir: ./src/tests` — specs outside that tree are invisible to the runner.
- Single `chromium` project. Cross-browser needs new entries in `projects`.
- `fullyParallel: true`, `retries: 2` on CI only. `forbidOnly` and the CI `workers: 1` override are **commented out** in the config — a stray `test.only` will not fail CI as-is.
- `video: 'on'` (every test, not just failures) — `test-results/` grows fast locally.
- `trace: 'on-first-retry'`, so traces never appear locally where `retries: 0`. Use `--trace on` when debugging.
- Timeouts: test `60_000`, expect `10_000`.
- `@src/*` → `./src/*` path alias is declared in [tsconfig.json](tsconfig.json); Playwright resolves tsconfig paths natively, so it works at runtime as well as typecheck.
- Allure: `npm run test:allure` writes `allure-results/`, but `allure-commandline` is **not** a project dependency — rendering needs a separate global install.

## Conventions (from README)

- Specs only in `src/tests/`, named `<feature>.spec.ts`.
- Page objects in `src/pages/` hold locators + actions, **no assertions**; assertions live in specs.
- Relative `page.goto('/...')` so `baseURL` stays environment-driven. Note `example.spec.ts` violates this with a hard-coded `https://playwright.dev/` — don't copy that pattern.
- Prefer `getByRole` / `getByLabel` / `getByTestId` over CSS/XPath; web-first `await expect(...)` over `waitForTimeout`.
- No hard-coded URLs or credentials in specs.

## CI

[.github/workflows/playwright.yml](.github/workflows/playwright.yml) on push/PR to `main` or `master`: `npm ci` → `playwright install --with-deps` → `playwright test` → upload `playwright-report/`. `npm ci` means `package-lock.json` must stay committed and in sync. The workflow has no `env:` block — secrets consumed by tests need mapping there from repo secrets, since `.env` is git-ignored.
