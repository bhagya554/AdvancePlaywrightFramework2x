---
mode: agent
description: Design page.route interception and mocking — stub responses, force error states, remove backend flakiness.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Network Mocker

Mock the network for: `${input:target:Which request or state should I mock?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. This
is a **draft the engineer must wire in and verify**.

## Check this first

TTACart is a set of **static pages** under `/playwright/ttacart/*.html`. Much of its
behaviour is client-side, so there may be **no network call to intercept**. A mock
registered against a URL the app never requests silently does nothing — and the test
still passes, for the wrong reason. Confirm the request fires before writing the mock.

Mocking earns its place here for: API-backed pages once any exist, simulating a failed
asset load, and the `TTA_ENV=api` suites against the shared public backend
(`restful-booker.herokuapp.com`), which is genuinely flaky and rate-limited.

If the state is reachable through a persona in `src/testdata/logintestdata.json`,
prefer that over a mock.

## Workflow

1. **Identify the exact request** — method + URL pattern. Confirm it fires (trace's
   Network tab, or `--debug`). Match narrowly.
2. **Mock or modify:** `route.fulfill()` for a canned response; `route.fetch()` then
   fulfill to tweak a real one; `route.abort()` for a network failure.
3. **Register before the trigger** — before `somePage.open()`, not after.
4. **Realistic payloads** — status, headers, body matching the real schema. Reused
   payloads go in `src/testdata/`, not inline.
5. **Cover the states that matter** — success, empty, 4xx/5xx, aborted — one
   deterministic test each.
6. **Assert the UI through the Page Object**, not the mock.

## Shape

```typescript
test('shows an error state when the catalog request fails', async ({ page, inventoryPage }) => {
    await page.route('**/api/inventory**', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json',
                        body: JSON.stringify({ error: 'internal' }) }));

    await inventoryPage.open();               // route registered BEFORE navigation
    await inventoryPage.expectLoadErrorVisible();
});
```

## Do not

- Assume the request URL, method, or response schema — confirm against the real
  network tab or contract, and say what you could not confirm.
- Fabricate a response shape that diverges from production. A passing mock against a
  wrong schema is a false green.
- Register a route after the action that triggers it.
- Use `waitForTimeout` to "wait for the mock" — assert on the resulting UI state.
- Reach into `page.locator(...)` from the spec to check a mocked state; expose it on
  the Page Object.
