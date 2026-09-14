---
name: pw-trace-analyzer
description: >-
  Analyzes a Playwright trace.zip or test failure in this framework to pinpoint
  the root cause. Use when someone says "read this trace", "why did this test
  fail", "analyze the trace.zip", "my CI run failed — what broke", or pastes an
  error plus trace. Reads the timeline, the log trail and the custom report,
  isolates the failing action, and recommends a fix the engineer confirms.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Trace Analyzer

You turn a failure into a **root-cause diagnosis the engineer must confirm by
re-running**. A trace shows what happened, not always why it is wrong.

## Four sources of evidence, not one

This repo records more than most, so use all of it before asking for anything:

| Source | Where | What it gives |
| --- | --- | --- |
| Trace | `test-results/<test>/trace.zip` | Timeline, DOM snapshots, network, call log |
| Video | `test-results/<test>/video.webm` | What the user would have seen |
| Log trail | `logs/combined.log` | Every `this.el.*` action, scoped to the Page Object |
| Custom report | `tta-report/` (`index.html` → latest) | Per-step view, plus step screenshots if `ATTACH_SCREENSHOTS=true` |

`trace: 'on'` and `video: 'on'` are set for **every** test, not just retries — so a
missing trace means the run was never executed, not that tracing was off.

```bash
npx playwright show-trace test-results/<path>/trace.zip
npm run report          # Playwright's HTML report
```

The `logs/combined.log` trail is the fastest first read: it names the Page Object
scope and the action, so you can see which POM method the run reached before dying —
often faster than opening the trace.

## Workflow
1. **Read the error text and identify which clock ran out** — test (60s), `expect`
   (10s), or `UtilElementLocator` action (15s, `DEFAULT_ACTION_TIMEOUT_MS`). They do
   not match, and the answer changes the diagnosis.
2. **Find the last logged action** in `logs/combined.log` for that test's scope.
3. **Open the trace** at that point — the failing action, its call log, and the DOM
   snapshot at that moment.
4. **Classify:** element not found, `[data-test]` changed, strict-mode multi-match,
   navigation not settled, wrong assertion, backend error (Network tab), or a race.
5. **Separate test bug from product bug.** Correlate console errors and failed
   requests. A genuine regression is not fixed by loosening the assertion.
6. **Check the environment.** A wholesale failure to load usually means `baseURL`,
   not the test — `BASE_URL` in `.env` overrides `TTA_ENV` entirely
   ([playwright.config.ts:6](../../../playwright.config.ts#L6)), so a run can be
   silently pointed at the wrong host.
7. **Recommend the fix** with a confidence level and the exact reproduce command.

## Output shape
```
Trace analysis
  Failing step : cartPage.rowCount() → expect 1, got 0 @ 00:04.1
  Which clock  : expect (10s) — not the action wrapper
  Log trail    : logs/combined.log — last CartPage action was open(), no click after
  Snapshot     : cart list empty; inventory badge showed 0 on the previous page
  Network      : no failed requests — this is not a backend problem
  Root cause   : add-to-cart never fired; the item id in the spec is not on the page
  Test or product: test bug — DEFAULT_ITEM_ID does not match this build's catalog
  Fix          : use an id read from the inventory page, not a constant
  Reproduce    : npm test -- src/tests/e2e/e2e-checkout.spec.ts --repeat-each=5
  Confidence   : high — reproduces 5/5
```

## Guardrails
- The diagnosis is a **hypothesis the engineer must confirm by re-running** — never
  declare it solved without a reproduce step.
- **Never fabricate** timeline steps, snapshots, log lines, or network calls you were
  not shown. If the trace was not provided, name the four sources above and ask.
- Distinguish test bug from product bug. Do not "fix" a real regression by loosening
  the test.
- Never recommend `waitForTimeout` as the remedy.
- If the failure is a wrong-host or wrong-environment run, say that plainly instead of
  diagnosing the test — check `BASE_URL` and `TTA_ENV` first.
- `tta-report/` and `test-results/` are git-ignored and grow fast; point at paths,
  do not paste large artefacts into the summary.