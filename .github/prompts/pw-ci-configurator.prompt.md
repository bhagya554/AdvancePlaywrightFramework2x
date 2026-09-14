---
mode: agent
description: Generate or fix the GitHub Actions workflow for this suite — env mapping from secrets, pinned Node, sharding, blob reporting and artifacts.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW CI Configurator

Change CI for: `${input:goal:What should CI do — shard, pass env vars, upload traces, add a browser?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. This is
a **draft the engineer must commit and run**.

## What exists, and what is broken

`.github/workflows/playwright.yml` runs on push/PR to `main`/`master`: `npm ci` →
`playwright install --with-deps` → `npx playwright test` → upload
`playwright-report/`. Gaps, in priority order:

1. **No `env:` block.** Nothing from `.env` reaches CI — `TTA_ENV`, `LOG_LEVEL`,
   `ATTACH_SCREENSHOTS`, `STANDARD_USER`, `TTA_SECRET` are all unset, so credentials
   fall back to `standard_user` / `tta_secret`. This is the fix that matters most.
2. **`node-version: lts/*`** — the repo needs **Node ≥ 22.12** (Faker v10 is ESM-only).
   Pin it.
3. **`forbidOnly` and the CI `workers: 1` override are commented out** in
   `playwright.config.ts` — a stray `test.only` passes CI silently. That is a config
   fix, not a workflow fix; mention both.
4. **Installs every browser** — the suite has one `chromium` project.
5. **No sharding.** `retries: 2` already applies on CI.
6. **Only `playwright-report/` is uploaded** — `test-results/` (traces, videos) and
   `tta-report/` do not survive the run.

## Workflow

1. **Confirm the runtime** — Node version, package manager, target `TTA_ENV`, and
   which secrets actually exist. Do not assume secret names.
2. **Map the environment explicitly**, including `BASE_URL: ''` alongside `TTA_ENV` —
   same reason the npm scripts blank it: a non-empty `BASE_URL` wins and pins every
   job to one host.
3. **Install narrowly** — cache npm, `--with-deps chromium`.
4. **Shard** — matrix of `shardIndex/shardTotal`, each job with `--reporter=blob`, then
   one `merge-reports` job producing a single HTML report.
5. **Persist evidence** — upload `playwright-report/`, `test-results/`, `tta-report/`
   with `if: always()`.
6. **`fail-fast: false`** so one shard's failure does not cancel the others.

## Shape

```yaml
env:
  BASE_URL: ''                      # load-bearing: keeps TTA_ENV in charge
  TTA_ENV: qa
  STANDARD_USER: ${{ secrets.STANDARD_USER }}
  TTA_SECRET: ${{ secrets.TTA_SECRET }}

jobs:
  test:
    strategy:
      fail-fast: false
      matrix: { shard: [1, 2, 3, 4] }
    steps:
      - uses: actions/setup-node@v4
        with: { node-version: '22.12', cache: npm }   # lts/* is not enough
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --shard=${{ matrix.shard }}/4 --reporter=blob
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: blob-${{ matrix.shard }}, path: blob-report/, retention-days: 7 }
```

Then a `merge` job with `needs: [test]`, `if: always()`, downloading `blob-*` and
running `npx playwright merge-reports --reporter=html`.

## Do not

- Hardcode credentials. Reference `secrets.*`; list the secrets the engineer must create.
- Drop `BASE_URL: ''` when adding an environment.
- Switch `npm ci` to `npm install` to dodge a lockfile error — fix the lockfile.
- Upload one HTML report per shard; they conflict. Blob reports merge, HTML does not.
- Omit `if: always()` on an upload — you lose evidence on exactly the runs that matter.
- Ignore artifact volume: `trace: 'on'` and `video: 'on'` record every test, and
  sharding multiplies it. Set retention.
