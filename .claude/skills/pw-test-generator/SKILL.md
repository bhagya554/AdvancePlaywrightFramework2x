---
name: pw-test-generator
description: >-
  Generates a Playwright spec for this framework from a described user flow or
  scenario. Use when someone says "write a Playwright test for login", "generate
  a spec for the checkout flow", "turn this scenario into a test", or pastes
  acceptance criteria that need automating. Produces a runnable draft wired to
  @fixtures/test-base and the TTACart Page Objects — the engineer still runs it.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Test Generator

You draft a **spec the engineer must still run and review** — never a "finished"
test. You translate a flow into this framework's idioms, not generic Playwright.

## When to use
- A user flow, scenario, or acceptance criteria needs a spec.
- Someone says "write/generate a Playwright test for X".
- A manual test case needs converting to automation.

## Framework rules that override generic Playwright advice

1. **Import from the fixture base, not `@playwright/test`.**
   `import { test, expect } from '@fixtures/test-base';`
2. **Never construct a Page Object in a spec.** Ask for it as a fixture. Ask for a
   *state* fixture when the test needs setup: `validLogin`, `invalidLogin`,
   `loginWithInventory`, `loginWithSelectedItem` — all implemented in
   [test-base.ts](../../../src/fixtures/test-base.ts). Logging in through the UI
   inside a spec is a bug when a fixture already does it.
3. **Never hard-code a URL.** Call `somePage.open()`; `PATH` + `baseURL` handle the
   environment. A literal `https://…` in a spec breaks every `test:<env>` script.
4. **Specs live under `src/tests/`** — `testDir` is `./src/tests`, so a spec outside
   that tree is invisible to the runner. Group by feature: `src/tests/<area>/`.
5. **Steps: pick one.** Either `visualStep(page, …)` throughout, or raw `test.step`
   throughout — never both in one spec. Mixing desynchronises the CustomReporter's
   step counter and screenshots land on the wrong step.
6. **Locators are `[data-test="…"]`** and they belong in the Page Object, not the
   spec. If the flow needs an element no POM exposes, add it to the POM.
7. **Assertions.** Readiness assertions live in the POM (`assertLoaded()`); the
   behaviour under test is asserted in the spec.

## Workflow
1. **Restate the flow** as ordered steps (arrange → act → assert). Confirm the entry
   page, the persona, and the observable success signal.
2. **Map each step to an existing POM method.** Read the POM first. If a method is
   missing, say so and draft it rather than reaching into `page` from the spec.
3. **Pick the cheapest fixture** that reaches the arrange state — prefer
   `loginWithSelectedItem` over re-doing login + add-to-cart by hand.
4. **Choose web-first assertions** (`await expect(locator).toBeVisible()`,
   `toHaveText`, `toHaveURL`). Assert end state, never sleeps.
5. **Tag the test** (`@P0`, `@smoke`) so `npm test -- -g "@P0"` can select it.
6. **List assumptions** — persona used, test data, POM methods you had to invent.

## Output shape
```typescript
import { test, expect } from '@fixtures/test-base';
import { visualStep } from '@utils/visualStep';
import { DataGenerator } from '@utils/DataGenerator';

test.describe('Checkout @P0', () => {
    test('completes an order for the standard user', async ({
        page, loginWithSelectedItem, cartPage, checkoutStepOnePage,
        checkoutStepTwoPage, checkoutCompletePage,
    }) => {
        await visualStep(page, 'open the cart', async () => {
            await cartPage.open();
            await expect.poll(() => cartPage.rowCount()).toBe(1);
        });

        await visualStep(page, 'fill customer details', async () => {
            await cartPage.checkout();                  // navigates to step one
            await checkoutStepOnePage.assertLoaded();
            await checkoutStepOnePage.fillGuest(DataGenerator.checkoutCustomer());
            await checkoutStepOnePage.continue();
        });

        await visualStep(page, 'finish the order', async () => {
            await checkoutStepTwoPage.assertLoaded();
            await checkoutStepTwoPage.finish();
            await checkoutCompletePage.assertOrderComplete();
        });
    });
});
```

Note what the example does *not* do: `CheckoutStepOnePage` has no `open()` — it is
reached through `cartPage.checkout()`. Read the POM before calling a method; several
of these pages are mid-flow only.

## Guardrails
- This is a **draft the engineer must run** — `npm test -- <spec>` then
  `npm run typecheck`. Typecheck is the only static gate in this repo.
- Never invent a `data-test` value. Read the POM or the page; if the element is not
  there, mark `// TODO: confirm data-test` and say so in the summary.
- No `waitForTimeout`, no `networkidle`, no manual sleeps.
- No XPath, no `nth-child`, no CSS-class chains — `[data-test="…"]` is the convention.
- Do not `new LoginPage(page)` in a spec, and do not import `test` from
  `@playwright/test`. [Login.spec.ts](../../../src/tests/login/Login.spec.ts) still
  does both; it is the old style, not the target.
- `problem_user` clears `firstName` on the first checkout-step-one submit. That is
  deliberate — a spec using that persona submits twice; do not paper over it in the POM.
