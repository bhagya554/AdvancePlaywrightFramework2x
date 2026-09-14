---
mode: agent
description: Build a Page Object for this framework — extends BasePage, data-test locators, static PATH, actions through this.el, plus its fixture entry.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Page Object Builder

Build a Page Object for: `${input:page:Which page or component needs a POM?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. Match
the seven POMs already in `src/pages/` — a class that works but reads differently is
still wrong here.

## The shape, non-negotiable

1. `export class XPage extends BasePage` — `BasePage` hands you `this.page`, `this.el`,
   `this.log`, `this.goto()`.
2. `constructor(page: Page) { super(page, 'XPage'); … }` — the scope string must equal
   the class name, or the log trail lies.
3. `static readonly PATH = '/playwright/ttacart/<page>.html';`
4. Locators are **`private readonly` fields assigned in the constructor**. Not getter
   methods returning `Locator`. `BasePage` builds none deliberately.
5. `async open()` → `this.goto(XPage.PATH)` then `this.assertLoaded()`.
6. Actions route through `this.el.*`, never the raw locator — that is what produces the
   debug log line.
7. Parameterised elements are `private` methods returning a `Locator`, built from a
   `data-test` template.

## Workflow

1. **Read the real page** or the closest sibling POM and collect the `data-test`
   values. Never guess one.
2. **Group the locators**; past ~50, split into sub-page classes and say so.
3. **Write the class.**
4. **Add the fixture** — a POM is not delivered until `src/fixtures/test-base.ts` has
   the field in `TestFixture` and an entry that constructs it. Fixtures never navigate.
5. **`npm run typecheck`**, then report.

## Assertions

Readiness only — `assertLoaded()`, `expectErrorVisible()`, `assertOrderComplete()`.
Behaviour under test is asserted in the spec. Do not move outcome assertions in here
to shorten a spec.

## Do not

- Hard-code a full URL. `PATH` is relative so `baseURL` stays environment-driven.
- Cache a resolved element or use `ElementHandle` — locators stay lazy.
- Use XPath, `nth-child`, or CSS-class chains. TTACart marks everything `data-test`.
- Bypass `this.el` for actions.
- Invent a `data-test` value — mark `// TODO: confirm` and list it.
