---
name: pw-ci-configurator
description: >-
  Generates or fixes the GitHub Actions workflow for this Playwright suite. Use
  when someone says "set up Playwright in CI", "fix the CI workflow", "shard my
  tests across jobs", "upload traces and the report", "pass env vars to CI", or
  "run browsers in a matrix". Produces a workflow with install, env mapping,
  sharding, blob reporting and artifacts — a draft the engineer commits and runs.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW CI Configurator

You draft a **workflow the engineer must commit and run on their runner** — never a
guaranteed-green pipeline.

## What this repo already has, and what is broken

[.github/workflows/playwright.yml](../../../.github/workflows/playwright.yml) runs on
push/PR to `main`/`master`: `npm ci` → `playwright install --with-deps` →
`npx playwright test` → upload `playwright-report/`.

Known gaps, in priority order:

1. **No `env:` block.** Nothing from `.env` reaches CI. `TTA_ENV`, `LOG_LEVEL`,
   `ATTACH_SCREENSHOTS`, `STANDARD_USER`, `TTA_SECRET` are all unset, so the run uses
   hard-coded defaults and the credentials fall back to `standard_user` /
   `tta_secret`. Map them from repo secrets — this is the fix that matters most.
2. **`node-version: lts/*`.** The repo requires **Node ≥ 22.12** (Faker v10 is
   ESM-only and loads via `require(esm)`). Pin `22.12` or later rather than trusting
   whatever `lts/*` resolves to on a given day.
3. **`forbidOnly` and the CI `workers: 1` override are commented out** in
   `playwright.config.ts`. A stray `test.only` passes CI silently, testing one thing.
   Fixing that is a config change, not a workflow change — mention both.
4. **Installs every browser.** The suite has one `chromium` project; `--with-deps
   chromium` is faster.
5. **No sharding**, and `retries: 2` applies on CI already.
6. **Only `playwright-report/` is uploaded.** `test-results/` holds the traces and
   videos (`trace: 'on'`, `video: 'on'` for every test) and `tta-report/` is the
   custom reporter's output. Neither survives the run.

## Workflow
1. **Confirm the runtime** — Node version, package manager, which env the CI run
   should target (`TTA_ENV`), and which secrets exist in the repo.
2. **Map the environment explicitly.** Set `BASE_URL: ''` alongside `TTA_ENV` for the
   same reason the npm scripts do: a non-empty `BASE_URL` wins over `TTA_ENV` and
   pins every job to one host.
3. **Install narrowly** — cache npm, install only `chromium`.
4. **Shard for speed** — matrix of `shardIndex/shardTotal`, each job with the **blob**
   reporter, then one `merge-reports` job producing a single HTML report. Never
   upload one HTML report per shard; they conflict.
5. **Persist evidence** — upload `playwright-report/`, `test-results/` and
   `tta-report/` with `if: always()`.
6. **Keep `fail-fast: false`** so one shard's failure does not cancel the others.

## Output shape
```yaml
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

env:
  BASE_URL: ''                      # load-bearing: keeps TTA_ENV in charge
  TTA_ENV: qa
  LOG_LEVEL: info
  TEST_ENV: ci
  STANDARD_USER: ${{ secrets.STANDARD_USER }}
  TTA_SECRET: ${{ secrets.TTA_SECRET }}

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.12'     # Faker v10 is ESM-only; lts/* is not enough
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --shard=${{ matrix.shard }}/4 --reporter=blob
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: blob-${{ matrix.shard }}
          path: blob-report/
          retention-days: 7
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: traces-${{ matrix.shard }}
          path: test-results/
          retention-days: 7

  merge:
    if: always()
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22.12', cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { pattern: blob-*, path: all-blobs, merge-multiple: true }
      - run: npx playwright merge-reports --reporter=html ./all-blobs
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Guardrails
- This is a **draft the engineer must commit and run** — never assume secret names
  exist. List the secrets the workflow needs and let the engineer create them.
- **Never hardcode credentials.** Reference `secrets.*`; do not invent values.
- `npm ci` requires `package-lock.json` committed and in sync — do not switch to
  `npm install` to dodge a lockfile error; fix the lockfile.
- Do not drop `BASE_URL: ''` when adding an environment. It is the same trap the
  `test:<env>` scripts work around.
- Shards emit **blob** reports merged in a follow-up job. One HTML report per shard
  overwrites itself.
- `if: always()` on every upload, or you lose evidence on exactly the runs that matter.
- Sharding multiplies artifact volume — `trace: 'on'` and `video: 'on'` record for
  every test, not just failures. Set a retention period.