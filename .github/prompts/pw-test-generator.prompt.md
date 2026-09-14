---
mode: agent
description: Generate a Playwright spec for this framework from a described user flow — wired to @fixtures/test-base and the TTACart Page Objects.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Test Generator

Write a Playwright spec for: `${input:flow:Which user flow or acceptance criteria should I automate?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md` and
apply automatically. This is a **draft the engineer must run** — never a finished test.

## Workflow

1. **Restate the flow** as arrange → act → assert. Confirm the entry page, the
   persona, and the observable success signal.
2. **Read the Page Objects first** (`src/pages/`). Map each step to an existing POM
   method. If a method is missing, draft it in the POM — never reach into `page` from
   the spec.
3. **Pick the cheapest fixture** that reaches the arrange state: `validLogin`,
   `invalidLogin`, `loginWithInventory`, `loginWithSelectedItem`. Logging in by hand
   when a fixture exists is a bug.
4. **Use web-first assertions** — `await expect(locator).toBeVisible()`, `toHaveText`,
   `expect.poll(...)` for values that settle. Assert end state, never sleeps.
5. **Tag it** (`@P0`, `@smoke`) so `npm test -- -g "@P0"` can select it.
6. **Verify** — `npm run typecheck`, then `npm test -- <spec>`. Report what actually
   happened, including failures.
7. **List assumptions** — persona, test data, POM methods you invented.

## Shape

```typescript
import { test, expect } from '@fixtures/test-base';
import { visualStep } from '@utils/visualStep';
import { DataGenerator } from '@utils/DataGenerator';

test.describe('Checkout @P0', () => {
    test('completes an order for the standard user', async ({
        page, loginWithSelectedItem, cartPage,
        checkoutStepOnePage, checkoutStepTwoPage, checkoutCompletePage,
    }) => {
        await visualStep(page, 'open the cart', async () => {
            await cartPage.open();
            await expect.poll(() => cartPage.rowCount()).toBe(1);
        });
        await visualStep(page, 'finish the order', async () => {
            await cartPage.checkout();                  // step one has no open()
            await checkoutStepOnePage.fillGuest(DataGenerator.checkoutCustomer());
            await checkoutStepOnePage.continue();
            await checkoutStepTwoPage.finish();
            await checkoutCompletePage.assertOrderComplete();
        });
    });
});
```

Read the POM before calling a method — several of these pages are mid-flow only and
have no `open()`.

## Do not

- Import `test` from `@playwright/test`, or construct a Page Object in the spec.
- Hard-code a URL — `open()` plus `PATH` keeps `baseURL` environment-driven.
- Invent a `data-test` value. Mark `// TODO: confirm` and say so in the summary.
- Mix `visualStep` and raw `test.step` in one spec.
- Use `waitForTimeout`, `networkidle`, XPath, `nth-child`, or CSS-class selectors.
