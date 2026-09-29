# Running the E2E tests in parallel

## The goal

The `src/tests/e2e/` folder has 4 spec files and 11 tests in total. Run one after another they
take about **42 seconds**. Run in parallel with 4 workers they take about **19 seconds**. These notes
explain how Playwright does that, which switches control it, and why these specs are safe to run in parallel.

## Two words to know

- **Worker:** a separate Node.js process with its own browser. Four workers means four browsers
  running tests at the same time.
- **Test isolation:** every test gets a brand-new browser context and page: fresh cookies,
  fresh localStorage, an empty cart. Tests never see each other's state, even when two of them
  run in the same worker one after the other.

## The two switches in `playwright.config.ts`

```ts
fullyParallel: true,                               // WHAT can be split across workers
//workers: process.env.CI ? 1 : undefined,         // HOW MANY workers (commented out)
```

| Setting | Meaning | Value in this project |
|---|---|---|
| `workers` | Maximum number of worker processes | Not set, so Playwright's default applies: **50% of logical CPU cores** (8 cores gives 4 workers) |
| `fullyParallel` | `false`: files run in parallel, but tests *inside* a file run in order in one worker. `true`: every test can go to any free worker | **`true`** |

Because `fullyParallel` is `true`, even the 5 tests inside `e2e-checkout_3-MoreFixtureUsage.spec.ts`
are spread across workers, not queued behind each other.

## What's in the folder

| File | Tests | Why it has that many |
|---|---|---|
| `e2e-checkout_1.spec.ts` | 1 | One checkout test. Login happens in `beforeEach` |
| `e2e-checkout_2-data-driven.spec.ts` | 4 | One test per row in `checkouttestdata.json` (a `for` loop creates the tests) |
| `e2e-checkout_3-MoreFixtureUsage.spec.ts` | 5 | One test per state fixture (`validLogin`, `invalidLogin`, ...) |
| `e2e-checkout_4-env.spec.ts` | 1 | Same flow as file 1, with the item id read from `.env` |
| **Total** | **11** | |

Check the count yourself without running anything:

```bash
npx playwright test src/tests/e2e --list
```

## Commands

Run all of these from the project root.

```bash
# Default: parallel, 50% of CPU cores
npx playwright test src/tests/e2e

# Choose the number of workers
npx playwright test src/tests/e2e --workers=4

# Percentage of CPU cores
npx playwright test src/tests/e2e --workers=75%

# Serial: one test at a time (useful for debugging)
npx playwright test src/tests/e2e --workers=1

# Only the P0 tests, in parallel
npx playwright test src/tests/e2e -g "@P0" --workers=4

# Same thing through the npm scripts (note the -- before the Playwright flags)
npm run test:qa -- src/tests/e2e --workers=4
```

`--workers` on the command line always wins over the config value.

## How to check how many workers were used

The first line of every run tells you:

```
Running 11 tests using 4 workers
```

That number is the **maximum**. Playwright never starts more workers than there are tests
that can run at the same time. For example, 2 tests gives `2 workers`, and a `describe.serial` block gives `1 worker`.

Inside a test you can print which worker ran it:

```ts
test('example', async ({}, testInfo) => {
    console.log(`worker ${testInfo.parallelIndex}`)   // 0, 1, 2 or 3 with 4 workers
})
```

## Measured on this project (8-core laptop, QA site)

| Command | Result |
|---|---|
| `npx playwright test src/tests/e2e --workers=1` | `Running 11 tests using 1 worker`, 11 passed, **42.5s** |
| `npx playwright test src/tests/e2e --workers=4` | `Running 11 tests using 4 workers`, 11 passed, **18.7s** |

It's not exactly 4x faster because each worker has to start its own browser, and the slowest
test (`performance_glitch_user`, ~9s) sets the floor.

In the parallel run the `list` reporter prints tests **out of order** (test 5 finished last).
That's normal: each line is printed when its test *finishes*, not when it starts.

## Why these four specs are safe to run in parallel

Parallel runs only work when tests don't depend on each other. These specs follow the rules:

1. **No shared variables between tests.** Nothing like `let bookingId` at `describe` level
   that one test writes and another reads.
2. **Each test sets up its own state.** Login happens in `beforeEach` (files 1 and 4) or
   inside the test (file 2), or through a state fixture (file 3). No test assumes another
   test logged in first.
3. **Fresh data per test.** `DataGenerator.checkoutCustomer()` gives each test its own customer details.
4. **The cart lives in the browser context.** Every test gets a new context, so two tests adding
   items at the same time never see each other's cart.
5. **No `describe.serial`.** Nothing forces an order.

### Contrast: a spec that must NOT run in parallel

`src/tests/apiTests/03_restfulbooker_fixture_e2e_api/booking-crud-e2e-fixtures.spec.ts`
uses `test.describe.serial` because Update and Delete need the `bookingId` that Create saved.
Playwright runs that group in one worker, in order, whatever `--workers` says.

## Controlling parallel mode for a single file

You can override the config for one `describe` block:

```ts
test.describe.configure({ mode: 'parallel' })   // tests in this file spread across workers
test.describe.configure({ mode: 'serial' })     // in order; if one fails, the rest are skipped
test.describe.configure({ mode: 'default' })    // in order in one worker, but a failure doesn't skip the rest
```

Put it at the top of the file or inside a `describe`. Use `serial` only when tests truly depend on
each other. Otherwise, fix the dependency.

## Watch out for

- **`beforeAll` runs once per worker, not once per run.** With 4 workers, a `beforeAll` that
  creates data runs up to 4 times.
- **Shared server-side data.** If two parallel tests edit the *same* record on the server (same
  user profile, same booking id), they can break each other. Give each test its own data.
- **Headed mode with many workers** opens that many browser windows. Use `--workers=1` with `--headed`.
- **Disk usage.** This config records `video: 'on'` and `trace: 'on'` for every test, so more
  parallel tests means more files in `test-results/` at the same time.
- **CI.** The `workers: process.env.CI ? 1 : undefined` line is commented out, so CI also
  runs at 50% of its cores. CI machines are often small (2 cores gives 1 worker).

## Cheat sheet

| I want to... | Do this |
|---|---|
| Run in parallel (default) | `npx playwright test src/tests/e2e` |
| Choose the worker count | `--workers=4` or `--workers=50%` |
| Debug one test at a time | `--workers=1` |
| Set it permanently | `workers: 4` in `playwright.config.ts` |
| Keep one file in order | `test.describe.configure({ mode: 'serial' })` |
| See how many workers ran | First line of output: `Running N tests using X workers` |

## The reusable rule

**Parallel speed comes free only when each test builds its own state.** Playwright
already isolates the browser. Your job is to make sure no test depends on another test's leftovers.
