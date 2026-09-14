---
mode: agent
description: Diagnose a flaky test in this framework and propose a deterministic fix — reproduce first, read the trace already on disk, never add a sleep.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Flaky Debugger

Diagnose the flake in: `${input:test:Which test flakes, and what is the symptom?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. Your
output is a **hypothesis the engineer must reproduce** — flakiness is confirmed by
running, not by reading.

## Reproduce first

```bash
npm test -- src/tests/<spec> --repeat-each=20             # timing flake
npm test -- src/tests/<spec> --repeat-each=20 --workers=1 # ordering, or timing?
```

Fails in parallel but never at `--workers=1` → shared state, not a race.

`trace: 'on'` and `video: 'on'` are set for every test, so evidence for a local
failure is **already in `test-results/`**. Action logs are in `logs/combined.log`.
Read them before theorising.

## Which clock ran out

Test 60 000 ms · `expect` 10 000 ms · `UtilElementLocator` action 15 000 ms
(`DEFAULT_ACTION_TIMEOUT_MS`). A 15s action wrapper inside a 10s expectation, or three
chained 15s waits inside a 60s test, produces a timeout that looks random. Identify
the clock before proposing anything.

## Root causes, ranked for this repo

1. **Shared state across parallel tests** — `fullyParallel: true`, one set of TTACart
   personas. Two tests mutating one cart is the classic.
2. **A fixture that did not assert its own precondition.** `validLogin` and
   `invalidLogin` verify the outcome before handing over for exactly this reason.
3. **Hard waits** — `waitForTimeout`, or `networkidle` masking a race.
4. **Non-retrying assertions** — `expect(await el.count())` snapshots; `expect.poll(...)`
   and web-first matchers retry.
5. **`problem_user`** clears `firstName` on the first checkout-step-one submit by
   design. A spec submitting once with that persona is not flaky, it is wrong.
6. **Timeout mismatch** — see above.
7. **`ATTACH_SCREENSHOTS=true`** adds a screenshot per step; on a slow machine that
   alone can push a marginal test past 60s.

## Output

```
Flake diagnosis
  Symptom   : ...
  Evidence  : test-results/.../trace.zip, logs/combined.log line N
  Root cause: ...
  Fix       : ...
  Confirm   : npm test -- <spec> --repeat-each=20  → expect 20/20
  Confidence: high — fails at --workers=4, never at --workers=1
```

## Do not

- Declare a flake fixed without a repeat-run.
- "Fix" it with `waitForTimeout`, `networkidle`, or a raised timeout. Raising
  `DEFAULT_ACTION_TIMEOUT_MS` to make a test pass is not a fix.
- Treat `retries: 2` (CI-only) as the remedy. It is a safety net.
- Fabricate the cause. This repo records a trace for every run — "no trace" usually
  means nobody looked.
- Hunt a race before checking whether the test is simply **wrong**.
