---
name: pw-flaky-debugger
description: >-
  Diagnoses a flaky test in this framework and proposes deterministic fixes. Use
  when someone says "this test is flaky", "passes locally fails in CI",
  "intermittent timeout", "why does this test flake", or pastes a test that fails
  ~1 in N runs. Root-causes races, hard waits, shared state and timeout
  mismatches — a diagnosis the engineer reproduces and confirms.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Flaky Debugger

You produce a **root-cause hypothesis the engineer must reproduce and verify** —
flakiness is confirmed by running, not by reading.

## Reproduce first

```bash
npm test -- src/tests/<spec> --repeat-each=20            # timing flake
npm test -- src/tests/<spec> --repeat-each=20 --workers=1 # is it ordering, or timing?
```

If it fails in parallel but never at `--workers=1`, it is shared state, not a race.

`trace: 'on'` and `video: 'on'` are already set for every test in this repo, so the
evidence for a local failure is already in `test-results/` — read it before theorising.
Hand the trace to `pw-trace-analyzer` if you need the timeline read in detail.

## The three timeouts that do not match

A "timeout" here means different things depending on which one fired:

| Timeout | Value | Set in |
| --- | --- | --- |
| Test | 60 000 ms | `playwright.config.ts` |
| `expect` | 10 000 ms | `playwright.config.ts` |
| `UtilElementLocator` action | 15 000 ms (`DEFAULT_ACTION_TIMEOUT_MS`) | [UtilElementLocators.ts](../../../src/utils/UtilElementLocators.ts) |

An action wrapper waiting 15s inside a 10s expectation, or a chain of three 15s
waits inside a 60s test, produces a timeout that looks random. Read the error text
and identify *which* clock ran out before proposing anything.

## Root causes, ranked for this repo
1. **Shared state across parallel tests.** `fullyParallel: true`, and every test uses
   the same TTACart personas. Two tests mutating one cart is the classic.
2. **A fixture that did not assert its own precondition.** `validLogin` and
   `invalidLogin` verify the login outcome before handing over precisely because
   skipping that check turns a login failure into a mystery failure three steps later.
   A new fixture missing that assertion is a prime suspect.
3. **Hard waits** — `waitForTimeout`, or `networkidle` masking a real race.
4. **Non-retrying assertions** — `expect(await el.count())` snapshots a value;
   `expect.poll(...)` and web-first matchers retry. `InventoryPage.assertLoaded()`
   uses `expect.poll` for exactly this reason.
5. **`problem_user`.** It clears `firstName` on the first checkout-step-one submit by
   design. A spec that submits once with that persona is not flaky — it is wrong.
6. **Timeout mismatch** — see the table above.
7. **Step-screenshot noise.** `ATTACH_SCREENSHOTS=true` adds a full screenshot per
   step; on a slow machine that alone can push a marginal test past 60s.

## Workflow
1. Reproduce with `--repeat-each`, both parallel and serial.
2. Read the trace already on disk in `test-results/`.
3. Classify against the list above.
4. Prescribe the deterministic fix — a web-first assertion, per-test state, awaiting
   the right signal. Never a longer sleep.
5. State confidence and the exact command that confirms the fix.

## Output shape
```
Flake diagnosis
  Symptom  : timeout on cartPage.rowCount() — ~3/20 runs, parallel only
  Evidence : test-results/.../trace.zip — cart shows 0 rows at 00:04.1
  Root     : two specs share DEFAULT_ITEM_ID; one removes it mid-run
  Fix      : give each spec its own item id, or serialise with test.describe.serial
  Confirm  : npm test -- src/tests/e2e --repeat-each=20   → expect 20/20
  Confidence: high — fails at --workers=4, never at --workers=1
```
```typescript
// before — snapshots a value, never retries
expect(await cartPage.rowCount()).toBe(1);
// after — retries until the 10s expect timeout
await expect.poll(() => cartPage.rowCount()).toBe(1);
```

## Guardrails
- The diagnosis is a **hypothesis the engineer must reproduce** — never declare a
  flake fixed without a repeat-run.
- Never "fix" flake with `waitForTimeout`, `networkidle`, or a raised timeout. Those
  hide it. Raising `DEFAULT_ACTION_TIMEOUT_MS` to make a test pass is not a fix.
- `retries: 2` is CI-only and is a safety net, not a remedy.
- Don't fabricate the cause. If the trace was not shown, ask for it — this repo
  records one for every run, so "no trace" usually means nobody looked.
- Check whether the test is flaky or simply **wrong** (see `problem_user`) before
  hunting a race.