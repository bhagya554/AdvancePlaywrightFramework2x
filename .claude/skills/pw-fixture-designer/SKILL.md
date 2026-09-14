---
name: pw-fixture-designer
description: >-
  Designs Playwright fixtures for this framework — page-object fixtures and
  layered state fixtures in src/fixtures/test-base.ts, with correct scope and
  teardown. Use when someone says "create an auth fixture", "I need a logged-in
  page fixture", "set up test data fixtures", "stop repeating login in every
  test", or "expose this page object as a fixture". Produces a typed draft.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Fixture Designer

You extend **one file**: [src/fixtures/test-base.ts](../../../src/fixtures/test-base.ts).
This framework has a single fixture base; a second `test.extend` elsewhere splits the
suite and is almost always the wrong answer.

## When to use
- Setup is duplicated across specs and should become a fixture.
- A new Page Object needs exposing to specs.
- Tests need a pre-arranged state (logged in, item in cart, seeded data).

## What already exists — read before adding

`TestFixture` declares two groups:

| Group | Fixtures |
| --- | --- |
| Page objects (construct only, never navigate) | `loginPage`, `inventoryPage`, `itemDetailPage`, `cartPage`, `checkoutStepOnePage`, `checkoutStepTwoPage`, `checkoutCompletePage` |
| State (perform setup) | `validLogin`, `invalidLogin`, `loginWithInventory`, `loginWithSelectedItem` |

The state fixtures layer on each other: `loginWithSelectedItem` → `loginWithInventory`
→ `validLogin`, so login happens once per test however deep the chain goes.
`invalidLogin` is deliberately outside that chain. Playwright builds a fixture only
when a test names it, so the unused ones cost nothing.

Adding a fifth state fixture that logs in again from scratch is the main mistake here.
Depend on `validLogin` instead.

## Workflow
1. **Classify the fixture.** Page-object fixture → construct and `use()`, nothing
   else. State fixture → arrange, `use()`, tear down.
2. **Pick the scope.** Default is per-`test`. Reach for `{ scope: 'worker' }` only for
   expensive read-only setup; this suite is `fullyParallel: true`, so worker-scoped
   mutable state causes cross-test flake.
3. **Layer, don't duplicate** — take the nearest existing fixture as a dependency.
4. **Assert the fixture's own name is true** before handing over. `validLogin` calls
   `waitForLoginButtonHidden()`; `invalidLogin` calls `expectErrorVisible()`. Without
   that, a failed setup surfaces later at an unrelated step and misleads the reader.
5. **Tear down everything created** after `await use(...)`.
6. **Type it** — add the field to `TestFixture` so specs get IntelliSense — then
   `npm run typecheck`.

## Output shape
```typescript
// src/fixtures/test-base.ts

export type TestFixture = {
    // …existing fixtures…
    checkoutReady: CheckoutStepOnePage;   // new: cart filled, on step one
};

export const test = base.extend<TestFixture>({
    // …existing fixtures…

    /**
     * Depends on loginWithSelectedItem, so login + add-to-cart happen once.
     * Hands over checkout step one already open.
     */
    checkoutReady: async ({ loginWithSelectedItem, cartPage, checkoutStepOnePage }, use) => {
        await cartPage.open();
        await cartPage.checkout();
        await checkoutStepOnePage.assertLoaded();   // the fixture's name must be true
        await use(checkoutStepOnePage);
    },
});
```

For generated data, use the Faker helpers rather than literals:

```typescript
import { DataGenerator } from '@utils/DataGenerator';

customer: async ({}, use) => {
    await use(DataGenerator.checkoutCustomer());
},
```

## Guardrails
- This is a **draft the engineer must typecheck and run**. `npm run typecheck` is the
  only static gate in this repo.
- Page-object fixtures **construct only**. Navigation in a page-object fixture makes
  every spec that asks for the object pay for a page load it may not want.
- Never log in through the UI inside a state fixture that could depend on `validLogin`.
- Credentials come from [credentials.ts](../../../src/config/credentials.ts)
  (`STANDARD_USER` / `TTA_SECRET`), never inline. Note that `.env.example` advertises
  `USER_NAME` / `PASSWORD`, which nothing reads — do not follow it.
- Always tear down created resources; a leaking fixture flakes a parallel suite.
- No `waitForTimeout` in a fixture — wait on a web-first assertion.