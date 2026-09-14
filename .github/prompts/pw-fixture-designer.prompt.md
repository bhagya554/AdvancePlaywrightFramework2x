---
mode: agent
description: Design a Playwright fixture in src/fixtures/test-base.ts — correct scope, layered on existing state fixtures, with teardown.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Fixture Designer

Design a fixture for: `${input:need:What setup should become a fixture?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`.
You extend **one file**: `src/fixtures/test-base.ts`. A second `test.extend`
elsewhere splits the suite and is almost always wrong.

## Read what exists first

Page-object fixtures (construct only, never navigate): `loginPage`, `inventoryPage`,
`itemDetailPage`, `cartPage`, `checkoutStepOnePage`, `checkoutStepTwoPage`,
`checkoutCompletePage`.

State fixtures — **implemented and layered**: `loginWithSelectedItem` →
`loginWithInventory` → `validLogin`, so login happens once per test however deep the
chain goes. `invalidLogin` sits deliberately outside that chain.

Adding a state fixture that logs in from scratch is the main mistake here. Depend on
`validLogin` instead.

## Workflow

1. **Classify** — page-object fixture (construct, `use()`, done) or state fixture
   (arrange, `use()`, tear down).
2. **Scope** — default per-`test`. `{ scope: 'worker' }` only for expensive read-only
   setup; the suite is `fullyParallel: true`, so shared mutable state flakes.
3. **Layer** on the nearest existing fixture rather than duplicating it.
4. **Assert the fixture's own name is true** before `use()` — `validLogin` calls
   `waitForLoginButtonHidden()`, `invalidLogin` calls `expectErrorVisible()`. Skipping
   this turns a setup failure into a mystery failure three steps later.
5. **Tear down** everything created, after `await use(...)`.
6. **Type it** — add the field to `TestFixture` — then `npm run typecheck`.

## Shape

```typescript
checkoutReady: async ({ loginWithSelectedItem, cartPage, checkoutStepOnePage }, use) => {
    await cartPage.open();
    await cartPage.checkout();
    await checkoutStepOnePage.assertLoaded();   // the fixture's name must be true
    await use(checkoutStepOnePage);
},
```

Generated data comes from `DataGenerator` (Faker), not literals.

## Do not

- Navigate inside a page-object fixture — every spec asking for the object would pay
  for a page load it may not want.
- Log in through the UI in a fixture that could depend on `validLogin`.
- Inline credentials. They come from `src/config/credentials.ts`.
- Leak state. A fixture that does not clean up flakes a parallel suite.
- Use `waitForTimeout` — wait on a web-first assertion.
