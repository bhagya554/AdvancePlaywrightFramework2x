---
name: pw-network-mocker
description: >-
  Designs Playwright route interception and mocking for this framework. Use when
  someone says "mock this API", "stub the response", "force a 500 error state",
  "make this test deterministic without the backend", or "intercept network
  calls". Produces page.route / fulfill handlers to stub responses, simulate
  errors, and remove backend flakiness — a draft the engineer wires in and runs.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Network Mocker

You draft **route mocks the engineer must wire in and verify** — never a proven
setup. Mocks make a test deterministic and let it exercise states a real backend
will not produce on demand.

## Before you mock anything here

TTACart is a set of **static pages** under `/playwright/ttacart/*.html`. Much of its
behaviour is client-side, so there may be **no network call to intercept**. Check the
page first — a mock registered against a URL the app never requests silently does
nothing, and the test still passes for the wrong reason.

Mocking is the right tool in this repo for:

- API-backed pages, once any exist.
- Simulating an offline/failed asset load.
- The `TTA_ENV=api` suites, where the backend is a shared public instance
  (`restful-booker.herokuapp.com`) that is genuinely flaky and rate-limited.

If the state you want is reachable through a persona or test data instead
([logintestdata.json](../../../src/testdata/logintestdata.json) has five with
documented behaviours), prefer that over a mock.

## Workflow
1. **Identify the exact request** — method + URL pattern. Confirm it fires: run with
   `--debug` or check the trace's Network tab. Match narrowly.
2. **Decide mock vs. modify:** `route.fulfill()` for a canned response;
   `route.fetch()` then fulfill to tweak a real one; `route.abort()` for a network
   failure. Register the route **before** the navigation or action that triggers it —
   before `somePage.open()`, not after.
3. **Author realistic payloads** — status, headers, and a body matching the real
   schema. Reused payloads go in `src/testdata/`, not inline.
4. **Cover the states that matter** — success, empty, 4xx/5xx, aborted — each as its
   own deterministic test.
5. **Assert the UI behaviour** through the Page Object, not the mock.

## Output shape
```typescript
import { test, expect } from '@fixtures/test-base';

test('shows an error state when the catalog request fails', async ({ page, inventoryPage }) => {
    // registered BEFORE open() — the request fires during navigation
    await page.route('**/api/inventory**', (route) =>
        route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'internal' }),
        }));

    await inventoryPage.open();
    await inventoryPage.expectLoadErrorVisible();   // POM exposes the check
});

test('survives a dropped connection', async ({ page, inventoryPage }) => {
    await page.route('**/api/inventory**', (route) => route.abort('connectionfailed'));
    await inventoryPage.open();
    await inventoryPage.expectLoadErrorVisible();
});
```

## Guardrails
- This is a **draft the engineer must run** — never assume the request URL, method,
  or response schema; confirm against the real network tab or contract.
- **Verify the request actually happens.** A mock on a URL the static page never calls
  is a false green. Say so if you could not confirm it.
- Never fabricate a response shape that diverges from production — a passing mock
  against a wrong schema is worse than no test.
- Register routes before the triggering action; scope URL patterns tightly so you do
  not stub unrelated calls.
- No `waitForTimeout` to "wait for the mock" — assert on the resulting UI state.
- Assert through the Page Object. A spec reaching into `page.locator(...)` to check a
  mocked state is a locator finding as well as a mocking one.