# CustomWorld — TypeScript notes

Notes on the TypeScript syntax used in the Cucumber `CustomWorld` class.

```ts
import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber'
```

## `as const` on CRED

```ts
export const CRED = {
    standardUser: process.env.STANDARD_USER ?? 'standard_user',
    password: process.env.TTA_SECRET ?? 'tta_secret',
} as const;
```

With `as const`, TypeScript infers the properties as `readonly`:

```ts
readonly standardUser: string;
readonly password: string;
```

**Why use it?** It prevents accidental reassignment:

```ts
CRED.standardUser = 'admin'; // Error — readonly

// without `as const`:
CRED.standardUser = 'admin'; // allowed
```

## `!` — the definite assignment assertion

```ts
export class CustomWorld extends World {
    browser!: Browser;
    context!: BrowserContext;
    page!: Page;
}
```

The `!` after a property name tells TypeScript:

> "Trust me, this property will be assigned before it's used, even though I haven't initialized it here."

### Why it's needed

With `strictPropertyInitialization` on, TypeScript expects a property to be initialized either at the declaration:

```ts
class Example {
    browser: Browser = createBrowser(); // initialized
}
```

or in the constructor:

```ts
class Example {
    browser: Browser;

    constructor(browser: Browser) {
        this.browser = browser; // initialized
    }
}
```

Without either, you get:

```
Property 'browser' has no initializer and is not definitely assigned in the constructor.
```

`browser!: Browser` silences that, because you've promised it gets assigned later.

### Where the values actually get assigned

Not in this file — TypeScript only checks what it can see inside the class definition, and the `CustomWorld` constructor only calls `super(options)`. The real assignment happens in the Cucumber hooks:

```ts
Before(async function () {
    this.browser = await chromium.launch();
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    this.initPages();
});
```

The page objects are in exactly the same situation:

```ts
loginPage!: LoginPage;
inventoryPage!: InventoryPage;
cartPage!: CartPage;
```

They're assigned in `initPages()`, not the constructor:

```ts
initPages(): void {
    this.loginPage = new LoginPage(this.page);
    this.inventoryPage = new InventoryPage(this.page);
    this.cartPage = new CartPage(this.page);
}
```

### The two phases

**Phase 1 — the object is created.** Everything is still `undefined` at runtime, even though `!` makes TypeScript treat them as initialized:

```ts
const world = new CustomWorld(options);

world.browser   // undefined
world.context   // undefined
world.page      // undefined
world.loginPage // undefined
```

**Phase 2 — the setup hook runs.** Now everything has a value:

```ts
this.browser = await chromium.launch();
this.context = await this.browser.newContext();
this.page = await this.context.newPage();

this.initPages();
```

That gap between the two phases is the whole reason `!` is needed.

## `scratch` — `Record<string, unknown>`

`Record<string, unknown>` is equivalent to:

```ts
{
    [key: string]: unknown;
}
```

So `scratch` is an object that holds arbitrary key/value pairs — a notebook attached to the World, scoped to the current scenario:

```ts
this.scratch["orderId"] = "12345";
this.scratch["totalPrice"] = 99.99;
this.scratch["user"] = { name: "John" };
```

### What it's for

Passing values between steps. One step writes, a later step reads:

```ts
When('I create an order', async function () {
    const orderId = await this.inventoryPage.createOrder();
    this.scratch.orderId = orderId;
});

Then('the order should appear in history', async function () {
    const orderId = this.scratch.orderId as string;
    await expect(this.page.getByText(orderId)).toBeVisible();
});
```

You can store anything without changing the class definition:

```ts
this.scratch.orderId = "123";
this.scratch.customerId = "456";
this.scratch.productName = "Laptop";
```

### Why `unknown` instead of `any`

`Record<string, unknown>` is safer. With `unknown`, TypeScript forces you to narrow the type before using it:

```ts
const id = this.scratch.orderId;
id.toUpperCase(); // Error — object is of type 'unknown'

const id = this.scratch.orderId as string;
id.toUpperCase(); // OK
```

That stops you from accidentally treating a number as a string.

## `World`, `IWorldOptions`, `setWorldConstructor`

```ts
import {
    World,
    IWorldOptions,
    setWorldConstructor
} from '@cucumber/cucumber';
```

These three are Cucumber's test execution model — the mechanism that lets every step in a scenario share data.

### `World`

`World` is a Cucumber class representing the state of a **single scenario**. Given this feature:

```gherkin
Scenario: Login
    Given I open the application
    When I login
    Then I should see the dashboard
```

Cucumber creates one `World` object when the scenario starts, and every step definition in it shares that same instance:

```ts
Given('I open the application', function () {
    console.log(this);
});

When('I login', function () {
    console.log(this);
});
```

`this` in both steps refers to the same object.

**Why extend it?** To hold `browser`, `context`, `page`, and the page objects:

```ts
class CustomWorld extends World {
    page!: Page;
    loginPage!: LoginPage;
}
```

Every step can then reach them:

```ts
Given('I open application', async function () {
    await this.page.goto(BASE_URL);
});

When('I login', async function () {
    await this.loginPage.login();
});
```

### `IWorldOptions`

The type of the constructor parameter Cucumber passes when it creates a World:

```ts
constructor(options: IWorldOptions) {
    super(options);
}
```

Internally Cucumber does roughly `new CustomWorld(options)`, where `options` carries Cucumber-provided utilities. You rarely touch it directly — its job is type safety, so the signature is `options: IWorldOptions` rather than `options: any`.

### `setWorldConstructor`

The important one:

```ts
setWorldConstructor(CustomWorld);
```

It tells Cucumber:

> "Whenever you create a World for a scenario, use my `CustomWorld` class."

Without it, Cucumber instantiates its own default `World` for every scenario. With it, you get `CustomWorld`.

### The complete flow

1. Cucumber reads `setWorldConstructor(CustomWorld)`.
2. A scenario starts.
3. Cucumber creates `const world = new CustomWorld(options)`.
4. Your `Before` hook runs, assigning `this.browser` / `this.context` / `this.page`, then calls `this.initPages()`.
5. Steps use that same World — `this.page`, `this.loginPage`, `this.inventoryPage`, `this.scratch`.
6. The scenario ends and the World object is discarded.

### Analogy

A scenario is a school exam:

| Piece | Role |
|---|---|
| `World` | the student's answer sheet |
| `CustomWorld` | your customized sheet with extra sections |
| `IWorldOptions` | instructions provided when the sheet is created |
| `setWorldConstructor()` | telling Cucumber which sheet template to use |

That's why nearly every Cucumber + Playwright framework has:

```ts
class CustomWorld extends World { ... }

setWorldConstructor(CustomWorld);
```

It gives each scenario its own shared container for browser objects, page objects, and test data.
