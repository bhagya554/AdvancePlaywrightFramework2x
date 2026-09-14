---
mode: agent
description: Analyze a trace.zip or test failure — read the timeline, log trail and custom report, pinpoint the root cause, separate test bug from product bug.
tools: ['codebase', 'search', 'runCommands']
---

# PW Trace Analyzer

Analyze the failure in: `${input:failure:Which test failed? Paste the error, or point at the trace.}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. Your
output is a **diagnosis the engineer must confirm by re-running** — a trace shows what
happened, not always why it is wrong.

## Four sources of evidence, not one

| Source | Where | What it gives |
| --- | --- | --- |
| Trace | `test-results/<test>/trace.zip` | Timeline, DOM snapshots, network, call log |
| Video | `test-results/<test>/video.webm` | What the user would have seen |
| Log trail | `logs/combined.log` | Every `this.el.*` action, scoped by Page Object |
| Custom report | `tta-report/` (`index.html` → latest) | Per-step view and step screenshots |

`trace: 'on'` and `video: 'on'` apply to **every** test, not just retries — a missing
trace means the run never executed, not that tracing was off.

```bash
npx playwright show-trace test-results/<path>/trace.zip
npm run report
```

Read `logs/combined.log` first: it names the Page Object scope and action, so you can
see which POM method the run reached before dying — usually faster than the trace.

## Workflow

1. **Identify which clock ran out** — test (60s), `expect` (10s), or
   `UtilElementLocator` action (15s). They do not match, and it changes the diagnosis.
2. **Find the last logged action** for that test's scope.
3. **Open the trace** at that point — failing action, call log, DOM snapshot.
4. **Classify** — element not found, `data-test` changed, strict-mode multi-match,
   navigation not settled, wrong assertion, backend error, race.
5. **Separate test bug from product bug.** Correlate console errors and failed
   requests. A genuine regression is not fixed by loosening the assertion.
6. **Check the environment.** A wholesale load failure usually means `baseURL`, not
   the test — `BASE_URL` in `.env` overrides `TTA_ENV` entirely
   (`playwright.config.ts:6`).
7. **Recommend the fix** with a confidence level and the exact reproduce command.

## Output

```
Trace analysis
  Failing step   : ... @ 00:04.1
  Which clock    : expect (10s)
  Log trail      : logs/combined.log — last CartPage action was open()
  Snapshot       : ...
  Network        : ...
  Root cause     : ...
  Test or product: ...
  Fix            : ...
  Reproduce      : npm test -- <spec> --repeat-each=5
  Confidence     : ...
```

## Do not

- Fabricate timeline steps, snapshots, log lines, or network calls you were not shown.
  If the trace was not provided, name the four sources above and ask.
- Declare it solved without a reproduce step.
- Recommend `waitForTimeout`.
- Diagnose the test when the run was pointed at the wrong host — check `BASE_URL` and
  `TTA_ENV` first.
- Paste large artefacts into the summary; `tta-report/` and `test-results/` are
  git-ignored and grow fast. Point at paths.
