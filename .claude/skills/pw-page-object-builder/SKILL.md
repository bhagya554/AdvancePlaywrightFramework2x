---
name: pw-page-object-builder
description: >-
  Builds a Page Object for this framework — a class extending BasePage with
  data-test locators, a static PATH, an open(), and actions routed through
  this.el. Use when someone says "make a page object for the login page", "build
  a POM for X", "extract these locators into a page class", or wants inline
  selectors refactored out of a spec. Produces a draft to review and typecheck.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW Page Object Builder

You draft a **Page Object the engineer must wire up and verify**. It must match the
shape of the seven POMs already in [src/pages/](../../../src/pages/) — a POM that
works but reads differently is still wrong here.

## When to use
- A TTACart page needs a reusable POM.
- Inline locators in a spec should be extracted.
- Someone says "build/make a page object for X".

## The shape, non-negotiable

1. `export class XPage extends BasePage` — [BasePage](../../../src/pages/BasePage.ts)
   is abstract and hands you `this.page`, `this.el`, `this.log`, `this.goto()`.
2. `constructor(page: Page) { super(page, 'XPage'); … }` — the second argument is the
   logger scope and must equal the class name, or the log trail lies.
3. `static readonly PATH = '/playwright/ttacart/<page>.html';`
4. Every locator is a **`private readonly` field assigned in the constructor**.
   BasePage deliberately builds none. Do not use getter methods returning `Locator` —
   that is the upstream pack's style, not this repo's.
5. `async open(): Promise<void> { await this.goto(XPage.PATH); await this.assertLoaded(); }`
6. **Actions route through `this.el.*`**, not the raw locator. `this.el.click(x)` is
   what produces the debug log line; `x.click()` produces silence.
7. Parameterised elements are `private` methods returning a `Locator`
   (`private addBtn(id: string): Locator`), built from a `data-test` template.

## Assertions in a POM

Readiness only: `assertLoaded()`, `expectErrorVisible()`, `assertOrderComplete()`.
The behaviour under test is asserted in the spec. Do not move outcome assertions in
here to make a spec shorter.

## Workflow
1. **Read the real page** (or an existing sibling POM) and collect the `data-test`
   values. Never guess one.
2. **Group the locators** — header, form, list, footer. Past ~50 locators, split into
   sub-page classes and say so.
3. **Write the class** in the shape above.
4. **Add the fixture** — a new POM is useless until it is in
   [test-base.ts](../../../src/fixtures/test-base.ts): add the field to `TestFixture`
   and a `async ({ page }, use) => use(new XPage(page))` entry. Fixtures construct
   only; they never navigate.
5. **Typecheck** — `npm run typecheck`. Flag anything you guessed with `// TODO: confirm`.

## Output shape
```typescript
import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
    static readonly PATH = '/playwright/ttacart/index.html';

    private readonly username: Locator;
    private readonly password: Locator;
    private readonly loginButton: Locator;
    private readonly errorBanner: Locator;

    constructor(page: Page) {
        super(page, 'LoginPage');
        this.username = page.locator('[data-test="username"]');
        this.password = page.locator('[data-test="password"]');
        this.loginButton = page.locator('[data-test="login-button"]');
        this.errorBanner = page.locator('[data-test="error"]');
    }

    async open(): Promise<void> {
        await this.goto(LoginPage.PATH);
        await this.assertLoaded();
    }

    async assertLoaded(): Promise<void> {
        await expect(this.loginButton).toBeVisible();
    }

    async loginAs(username: string, password: string): Promise<void> {
        await this.el.fill(this.username, username);
        await this.el.fill(this.password, password);
        await this.el.click(this.loginButton);
    }

    async expectErrorContains(text: string): Promise<void> {
        await expect(this.errorBanner).toContainText(text);
    }
}
```

## Guardrails
- This is a **draft the engineer must run and review** — never assume a `data-test`
  value or a PATH exists; mark guesses `// TODO: confirm`.
- Never hard-code a full URL — `PATH` is relative so `baseURL` stays environment-driven.
- Locators are lazy `Locator` fields; never cache a resolved element or `ElementHandle`.
- No XPath, no `nth-child`, no CSS-class chains. TTACart marks everything with
  `data-test` — use it. `getByRole` is acceptable only where no `data-test` exists.
- Do not bypass `this.el` for actions; that is how the log trail is lost.
- A new POM without a matching fixture entry is half-delivered.
