# Cucumber in this framework

How the Cucumber layer is wired: which file does what, what loads what, and where the connections
between them actually live.

## The files, and how they connect

| File | Role |
|---|---|
| `cucumber.js` (repo root) | Execution config — which features, which steps, which reports |
| `src/cucumber/tsconfig.json` | TypeScript settings used at runtime by the TS loader |
| `src/cucumber/support/world.ts` | `CustomWorld` — the per-scenario state container |
| `src/cucumber/support/hooks.ts` | Lifecycle — launches the browser, fills the World, cleans up |
| `src/cucumber/<level>/steps/*.ts` | Step definitions — Gherkin phrases mapped to code |
| `src/cucumber/<level>/features/*.feature` | The scenarios themselves, in Gherkin |

The links between them:

```
cucumber.js
    │  requireModule → loads the TS loader so .ts files can run
    │  require       → support/**  +  steps/**
    │  paths         → features/**
    ▼
world.ts ──── setWorldConstructor(CustomWorld) ──→ Cucumber now builds CustomWorld per scenario
    │
    │  CustomWorld declares: browser, context, page, page objects, scratch
    ▼
hooks.ts ──── Before() assigns those fields ──────→ this.page, this.loginPage now exist
    │
    ▼
steps/*.ts ── read them off `this` ───────────────→ await this.loginPage.open()
    ▲
    │  matched by phrase
features/*.feature
```

Three connections are worth stating outright, because nothing in the code makes them visually obvious:

1. **`world.ts` → every step.** `setWorldConstructor(CustomWorld)` is what makes `this` inside a
   step definition a `CustomWorld` rather than Cucumber's default World.
2. **`hooks.ts` → `world.ts`.** The World only *declares* `browser` / `page` / the page objects.
   The `Before` hook is what assigns them. Declaration and assignment live in different files.
3. **`cucumber.js` → both.** Neither file is imported by anything; they run because
   `cucumber.js` lists `support/**` in `require`.

---

# 1. `cucumber.js` — the execution config

One of the first files Cucumber reads. It holds no test logic, only **execution configuration**.

### Analogy

Organizing a training program:

| Piece | Role |
|---|---|
| Feature files (`*.feature`) | Course syllabus — what to teach |
| Step definitions (`*.ts`) | Trainers — how to teach |
| Support files | Setup team — hooks, browser launch, utilities |
| `cucumber.js` | Organizer's master plan — which trainers, which syllabus, what reports |

## TypeScript bootstrap

```js
process.env.TS_NODE_PROJECT =
    process.env.TS_NODE_PROJECT || 'src/cucumber/tsconfig.json';
```

Tells the TypeScript loader which tsconfig to compile with at runtime. That file overrides the root
tsconfig to CommonJS, because the root is set to `module: preserve` for Playwright's sake.

## Support file list

```js
const support = ['src/cucumber/support/**/*.ts'];
```

A reusable list, spread into every profile's `require`. This is the line that causes `world.ts` and
`hooks.ts` to load at all.

## Common configuration

```js
const common = {
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: ['progress-bar', 'html:reports/cucumber/report.html', 'summary'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
};
```

### `requireModule`

Loaded **before** anything else, so that `.ts` files are runnable at all.

| Module | Effect |
|---|---|
| `ts-node/register` | Run `.ts` directly — `TypeScript -> Run`, instead of `TypeScript -> Compile -> JavaScript -> Run` |
| `tsconfig-paths/register` | Resolve tsconfig aliases, so `@pages/LoginPage` works instead of `../../../pages/LoginPage` |

### `format`

| Formatter | Effect |
|---|---|
| `progress-bar` | Live `██████████████ 80%` during the run |
| `html:reports/cucumber/report.html` | Writes an HTML report |
| `summary` | Command-line summary at the end |

The summary looks like:

```
10 scenarios
10 passed

50 steps
50 passed
```

### `snippetInterface: 'async-await'`

When a step has no definition, Cucumber prints a ready-to-paste stub in async/await style rather
than callback style:

```ts
Given('user logs in', async function () {

});
```

### `publishQuiet: true`

Suppresses the "Share your report online: https://reports.cucumber.io/..." banner.

## Execution profiles

Four profiles act as different execution modes.

### `default`

```js
default: {
    ...common,
    require: [...support, 'src/cucumber/**/steps/**/*.ts'],
    paths: ['src/cucumber/**/features/**/*.feature'],
}
```

All steps, all features, every level — `npx cucumber-js` runs everything.

### `level0` and `level1`

Scoped to one level each:

```bash
npx cucumber-js -p level0   # level-00-installation only
npx cucumber-js -p level1   # level-01-basic only
```

### `level2` — the interesting one

```js
level2: {
    require: [
        ...support,
        'src/cucumber/level-01-basic/steps/**/*.ts',
        'src/cucumber/level-02-data-driven/steps/**/*.ts'
    ],
    paths: [
        'src/cucumber/level-02-data-driven/features/**/*.feature'
    ]
}
```

It loads **two** step folders but only **one** feature folder. Because level-2 features reuse
level-1 step definitions — if level-1 defines `Given('I open login page')`, a level-2 feature can
use that phrase, so level-1's steps must be loaded for it to resolve.

## Does execution start from `cucumber.js`?

Technically no — Node launches the `cucumber-js` CLI, and the CLI reads `cucumber.js`:

1. `cucumber-js` command starts
2. Reads `cucumber.js`
3. Detects the profile
4. Loads support files (`world.ts`, `hooks.ts`)
5. Loads step definitions
6. Finds feature files
7. Executes `Before` hooks
8. Runs scenarios
9. Executes `After` hooks
10. Generates reports

```
        npx cucumber-js
               |
               v
          cucumber.js
               |
        +------+------+
        |             |
        v             v
   Support Files   Feature Files
  (world, hooks)    (*.feature)
        |             |
        +------+------+
               |
               v
       Step Definitions
         (*.steps.ts)
               |
               v
         Execute Tests
               |
               v
            Reports
```

**Coming from Playwright:** `cucumber.js` is the equivalent of `playwright.config.ts`. It doesn't
run tests — it controls what gets loaded and in which mode.

---

# 2. `world.ts` — the per-scenario state

Declares `CustomWorld`: `browser`, `context`, `page`, the page objects, and `scratch`. It declares
them but does not fill them — that is `hooks.ts`'s job.

The last line is the one that matters to every other file:

```ts
setWorldConstructor(CustomWorld)
```

Without it Cucumber builds its own default World and `this.page` would not exist anywhere.

> The TypeScript syntax in that file — `as const`, the `!` definite assignment operator,
> `Record<string, unknown>` — is covered separately in [world.md](world.md).

---

# 3. `hooks.ts` — the lifecycle

Controls browser launch, per-scenario setup, cleanup, and screenshot capture on failure.

```ts
import {
    BeforeAll, AfterAll, Before, After, Status, setDefaultTimeout,
} from '@cucumber/cucumber';
import { chromium, Browser } from '@playwright/test';
import { CustomWorld, BASE_URL } from './world';
```

### What each import does

| Import | Purpose |
|---|---|
| `BeforeAll` | Runs **once** before all scenarios |
| `AfterAll` | Runs **once** after all scenarios finish |
| `Before` | Runs before **every** scenario |
| `After` | Runs after **every** scenario |
| `Status` | Scenario result status — `Status.PASSED`, `Status.FAILED`, `Status.SKIPPED` |
| `setDefaultTimeout` | Maximum wait time per step |
| `chromium` | Launches the Chromium browser |
| `Browser` | Playwright's browser type |
| `CustomWorld` | The World type, so `this` is typed inside hooks |
| `BASE_URL` | Application URL, imported from `world.ts` |

## Step timeout

```ts
setDefaultTimeout(60_000);   // 60 seconds — the underscore is just a digit separator
```

Any step exceeding 60 seconds fails on timeout.

## `BeforeAll` — launch the browser once

```ts
let browser: Browser;

BeforeAll(async function () {
    browser = await chromium.launch({ headless: !process.env.HEADED })
});
```

`browser` is a module-level variable, `undefined` until this runs. The headless flag inverts an
env var:

| Command | `process.env.HEADED` | Result |
|---|---|---|
| `npx cucumber-js -p level0` | `undefined` | `headless: true` — runs in background |
| `HEADED=true npx cucumber-js -p level0` | `"true"` | `headless: false` — browser visible |

## `Before` — build the World for this scenario

```ts
Before(async function (this: CustomWorld) {
    this.browser = browser;
    this.context = await browser.newContext({ baseURL: BASE_URL });
    this.page = await this.context.newPage();
    this.initPages();
})
```

Four steps, in order:

1. **Share the browser** — one browser for the whole run, stored on the World so steps can reach it.
2. **Fresh context** — isolated cookies/storage per scenario. Setting `baseURL` here is what lets
   steps call `await page.goto('/')` instead of the full URL.
3. **New page** — the tab the scenario acts on.
4. **`initPages()`** — constructs the page objects against that page, so steps can call
   `await this.loginPage.login()`.

This is the hook that keeps the promise made by the `!` markers in `world.ts`.

## `After` — evidence, then cleanup

```ts
After(async function (this: CustomWorld, { result }) {
    if (result?.status === Status.FAILED && this.page) {
        const png = await this.page.screenshot();
        this.attach(png, 'image/png')
    }
    await this.page?.close();
    await this.context?.close();
})
```

Cucumber passes the scenario `result` in automatically. On failure only, it screenshots and attaches
the PNG to the report, then closes the page and context regardless of outcome.

### `this.attach(data, mediaType)`

`data` is the raw `Buffer` from `page.screenshot()`; `mediaType` tells Cucumber how to render it.
Without the media type the report has bytes it cannot display.

| File type | MIME type |
|---|---|
| PNG | `image/png` |
| JPEG | `image/jpeg` |
| Text | `text/plain` |
| JSON | `application/json` |
| HTML | `text/html` |

It works for any attachment, not just screenshots:

```ts
this.attach(JSON.stringify(response), 'application/json');
```

## `AfterAll` — close the browser

```ts
AfterAll(async function () {
    await browser?.close();
})
```

## Browser / Context / Page

```
Browser  = apartment building   → opened once in BeforeAll
Context  = apartment            → fresh per scenario in Before
Page     = room                 → fresh per scenario in Before
```

## Complete execution flow

```
Test Run Starts
       │
       ▼
BeforeAll ──── Launch Browser
       │
       ▼
Scenario 1
       │
       ▼
Before ──── Create Context
       │     Create Page
       │     Initialize Page Objects
       ▼
Given / When / Then steps
       │
       ▼
After ───── If failed → screenshot + attach
       │     Close Page
       │     Close Context
       ▼
Scenario 2 …
       │
       ▼
AfterAll ──── Close Browser
       │
       ▼
Execution Complete
```

Why this shape: the browser launches only once, every scenario still gets a clean context, failures
capture evidence automatically, and cleanup is safe even when setup failed part-way.

---

# 4. Step definitions — connecting Gherkin to code

This is where the feature file meets TypeScript.

**Feature file:**

```gherkin
Then the page title should contain "TTACart"
```

**Step definition:**

```ts
Then(
  'the page title should contain {string}',
  async function (this: CustomWorld, expected: string) {
    await expect(this.page).toHaveTitle(new RegExp(expected, 'i'));
  }
);
```

## How `{string}` reaches `expected`

Cucumber matches the feature line against the pattern, captures what `{string}` covered, and passes
it as the first real argument:

```
'the page title should contain {string}'
                                  │
                        captures "TTACart"
                                  │
                                  ▼
async function (this: CustomWorld, expected: string)
                                   expected = "TTACart"
```

So it behaves like `stepFunction("TTACart")`.

The parameter **name** is irrelevant — `expected`, `title`, `pageTitle`, `value` all work. Cucumber
only cares about the **number** and **order** of placeholders.

## What `new RegExp(expected, 'i')` does

That's the rest of the same line — what the captured value gets turned into before the assertion
runs. With `expected = "TTACart"`:

```ts
new RegExp(expected, 'i')   →   new RegExp("TTACart", "i")   →   /TTACart/i
```

A **regular expression** is a pattern for matching text, rather than a fixed string to compare
against. That distinction is the whole point here.

### Why a pattern instead of the plain string

`toHaveTitle` behaves differently depending on what you hand it:

| Argument | Playwright checks | Against `<title>TTACart Login</title>` |
|---|---|---|
| `"TTACart"` (string) | Title **equals** exactly | ❌ fails — `"TTACart Login" !== "TTACart"` |
| `/TTACart/` (regex) | Title **contains** a match | ✅ passes |

The feature file says "should **contain**", so a regex is what actually implements that wording. A
plain string would silently mean "should equal".

### What `'i'` means

The second argument to `new RegExp(pattern, flags)` is the **flags** string. `i` stands for
**ignore case**, so matching becomes case-insensitive:

```ts
new RegExp("TTACart", "i")   // matches TTACart, ttacart, TTACART, TtAcArT
new RegExp("TTACart")        // matches TTACart only
```

Useful because the same title is not always cased the same way across environments:

| Environment | Actual title | `/TTACart/` | `/TTACart/i` |
|---|---|---|---|
| QA | `TTACart Login` | ✅ | ✅ |
| UAT | `TTACART Login` | ❌ | ✅ |
| Production | `ttacart Login` | ❌ | ✅ |

One step definition then passes everywhere.

### Can it be any other character?

No — flags are a **fixed set of letters**, not free text. Each one has a defined meaning:

| Flag | Name | Effect |
|---|---|---|
| `i` | ignoreCase | Case-insensitive matching |
| `g` | global | Find all matches, not just the first |
| `m` | multiline | `^` and `$` match at line breaks, not just string start/end |
| `s` | dotAll | `.` also matches newlines |
| `u` | unicode | Treat the pattern as Unicode code points |
| `y` | sticky | Match only from `lastIndex` |
| `d` | hasIndices | Also report start/end positions of matches |

Anything outside that set throws immediately:

```ts
new RegExp("TTACart", "x")
// SyntaxError: Invalid flags supplied to RegExp constructor 'x'
```

You can combine them — `new RegExp(expected, 'gi')` is valid — but for `toHaveTitle` only `i` is
meaningful. `g` and `y` concern repeated scanning, and `m` / `s` concern newlines; a page title is a
single short line, so none of them change the outcome.

### One caveat

Because `expected` becomes a **pattern**, regex metacharacters inside it stop being literal. A
feature file saying:

```gherkin
Then the page title should contain "C++ (beta)"
```

would build `/C++ (beta)/i`, where `+` and `( )` are regex syntax rather than literal characters —
and this one throws outright:

```
SyntaxError: Invalid regular expression: /C++ (beta)/i: Nothing to repeat
```

Plain alphanumeric titles like `TTACart` are unaffected, but it's the reason this trick isn't
universally safe.

## Why `this` is not a parameter

```ts
async function (this: CustomWorld, expected: string)
```

This looks like two parameters but has only one at runtime. `this: CustomWorld` is a TypeScript
type annotation, not an argument — it tells the compiler to treat `this` as a `CustomWorld` inside
the function body. It disappears entirely once compiled.

`this` is the World instance Cucumber created for the current scenario, which is why `this.page`
resolves — `page` is declared on `CustomWorld` and assigned by the `Before` hook.

## Multiple parameters

```gherkin
Then I compare "A" and "B"
```

```ts
Then(
  'I compare {string} and {string}',
  async function (this: CustomWorld, first: string, second: string) {}
);
// first = "A", second = "B"
```

The rule:

| Part | Maps to |
|---|---|
| `this` | The Cucumber World object |
| 1st arg after `this` | First `{string}` / `{int}` |
| 2nd arg after `this` | Second `{string}` / `{int}` |
| 3rd arg after `this` | Third `{string}` / `{int}` |

## Playwright analogy

```ts
// Playwright Test — fixtures injected as parameters
test('example', async ({ page }) => { ... });

// Cucumber — World injected through `this`
async function (this: CustomWorld) {
    await this.page.goto('/');
}
```

`this.page` in Cucumber is the equivalent of `page` in Playwright Test. The difference is only how
it arrives: Playwright injects fixtures as parameters, Cucumber injects the World as `this`.

---

# Reference: optional chaining (`?.`)

```ts
object?.method()   // call only if `object` is not null/undefined
```

Used throughout the cleanup paths, because a scenario can fail before `page` or `context` ever got
assigned:

```ts
await browser?.close();       // same as: if (browser) await browser.close();
await this.page?.close();
await this.context?.close();
```

Without it, cleanup on a half-initialized scenario throws
`Cannot read properties of undefined` and masks the real failure.

---

# 5. Data-driven checkout — `checkout-external-data.spec.ts`

Step definitions in `src/cucumber/level-02-data-driven/steps/checkout-external-data.spec.ts`. Covers
the whole chain from a TypeScript interface, through reading a JSON file, to a reusable Cucumber step
that fills the checkout form from test data.

Topics:

1. The `CheckoutCustomer` interface
2. Interfaces vs. JavaScript objects
3. Reading files with `readFileSync`
4. `Record<string, CheckoutCustomer>`
5. Loading and accessing customer data
6. Using the data in a Cucumber step
7. The checkout workflow

## `CheckoutCustomer` — the interface

```ts
export interface CheckoutCustomer {
    firstName: string;
    lastName: string;
    postalCode: string;
}
```

An **interface** is a blueprint: it defines which properties an object must have, and their types.

### Analogy

A customer registration form:

```
Customer Registration Form

Required fields:
✅ First Name
✅ Last Name
✅ Postal Code
```

Every customer record must contain these fields.

### Valid

```ts
const customer: CheckoutCustomer = {
    firstName: 'Alice',
    lastName: 'Walker',
    postalCode: '560001',
};
```

### Invalid — missing property

```ts
const customer: CheckoutCustomer = {
    firstName: 'Alice',
    lastName: 'Walker',
};
// Error: Property 'postalCode' is missing
```

### Invalid — wrong type

```ts
const customer: CheckoutCustomer = {
    firstName: 'Alice',
    lastName: 'Walker',
    postalCode: 560001,
};
// Error: postalCode must be a string
```

## Is it a JavaScript object?

Yes. The interface exists only for TypeScript at development time — it disappears after compilation.

**TypeScript:**

```ts
const customer: CheckoutCustomer = {
    firstName: 'Alice',
    lastName: 'Walker',
    postalCode: '560001',
};
```

**Compiled JavaScript:**

```js
const customer = {
    firstName: 'Alice',
    lastName: 'Walker',
    postalCode: '560001',
};
```

## `import { readFileSync } from 'node:fs'`

`fs` = **File System**, a built-in Node.js module for reading, creating, updating and deleting files:

```ts
readFileSync()
writeFileSync()
mkdirSync()
unlinkSync()
```

### What `readFileSync()` does

Reads a file from disk. Given `customers.json`:

```json
{
  "alice": {
    "firstName": "Alice"
  }
}
```

```ts
const content = readFileSync('./customers.json', 'utf8');
```

`content` is a **string**, not an object yet:

```ts
'{
  "alice": {
    "firstName": "Alice"
  }
}'
```

### Why "Sync"?

It reads the whole file and **waits** until finished before moving to the next line.

| Synchronous | Asynchronous |
|---|---|
| Go to restaurant | Order food |
| Wait for food | Do other work |
| Get food | Get food later |
| Continue | |

### `node:fs` vs `fs`

Both work:

```ts
import { readFileSync } from 'fs';
import { readFileSync } from 'node:fs';
```

Modern Node.js prefers `node:fs` — the prefix makes it explicit that this is a built-in module, not
an npm package.

## The JSON file

`src/cucumber/level-02-data-driven/data/customers.json`:

```json
{
  "alice": {
    "firstName": "Alice",
    "lastName": "Walker",
    "postalCode": "560001"
  },
  "bob": {
    "firstName": "Bob",
    "lastName": "Singh",
    "postalCode": "110011"
  },
  "carol": {
    "firstName": "Carol",
    "lastName": "Mendes",
    "postalCode": "400001"
  }
}
```

Think of it as a customer book — each key holds one customer object:

```
Customer Book
│
├── alice
├── bob
└── carol
```

## `Record<string, CheckoutCustomer>`

```ts
type CustomerBook = Record<string, CheckoutCustomer>;
```

`Record<KeyType, ValueType>` is TypeScript shorthand for "an object whose keys are `KeyType` and
whose values are `ValueType`". Here:

| Part | Type |
|---|---|
| Key | `string` |
| Value | `CheckoutCustomer` |

```
alice → CheckoutCustomer
bob   → CheckoutCustomer
carol → CheckoutCustomer
```

Equivalent long form:

```ts
type CustomerBook = {
    [key: string]: CheckoutCustomer;
};
```

## Loading the data

```ts
const customers: CustomerBook = JSON.parse(
    readFileSync(join(__dirname, '../data/customers.json'), 'utf8')
);
```

Read inside-out:

1. **Build the path** — `join(__dirname, '../data/customers.json')`. `__dirname` is the folder of the
   current file, `src/cucumber/level-02-data-driven/steps/`, so the path resolves to
   `src/cucumber/level-02-data-driven/data/customers.json`. Using `__dirname` rather than a bare
   relative path makes it independent of where the command was run from.
2. **Read the file** — `readFileSync(path, 'utf8')` returns the file contents as a **string**.
3. **Parse** — `JSON.parse(...)` turns that string into a real JavaScript object.

The resulting object:

```ts
const customers = {
    alice: { firstName: 'Alice', lastName: 'Walker', postalCode: '560001' },
    bob:   { firstName: 'Bob',   lastName: 'Singh',  postalCode: '110011' },
    carol: { firstName: 'Carol', lastName: 'Mendes', postalCode: '400001' },
};
```

## Accessing a customer

Bracket notation, keyed by name:

```ts
customers['alice'];
// { firstName: 'Alice', lastName: 'Walker', postalCode: '560001' }

customers['bob'];
// { firstName: 'Bob', lastName: 'Singh', postalCode: '110011' }
```

Individual properties:

```ts
const customer = customers['alice'];

customer.firstName;   // 'Alice'
customer.lastName;    // 'Walker'
customer.postalCode;  // '560001'
```

## What is data-driven testing?

Instead of hard-coding data in the step:

```ts
fill('Alice');
fill('Walker');
fill('560001');
```

store it in JSON and look it up at runtime. One reusable step then serves every customer:

```gherkin
When I check out as the "alice" customer
When I check out as the "bob" customer
When I check out as the "carol" customer
```

## The step definition

```ts
When('I check out as the {string} customer', async function (this: CustomWorld, persona: string) {
    const customer = customers[persona];
    if (!customer) throw new Error(`No customer "${persona}" in customers.json`);
    // ... checkout workflow below
});
```

### `{string}` → `persona`

Cucumber captures the quoted value from the feature line:

| Feature line | `persona` |
|---|---|
| `When I check out as the "alice" customer` | `"alice"` |
| `When I check out as the "bob" customer` | `"bob"` |

### `customers[persona]`

With `persona = "alice"`, `customers[persona]` is `customers['alice']`:

```
persona
   ↓
"alice"
   ↓
customers["alice"]
   ↓
{ firstName: "Alice", lastName: "Walker", postalCode: "560001" }
```

### The validation guard

```ts
if (!customer) throw new Error(`No customer "${persona}" in customers.json`);
```

If the feature file says:

```gherkin
When I check out as the "john" customer
```

but the JSON only has `alice`, `bob`, `carol`, then `customers['john']` is `undefined`. Without the
guard the step would fail later with a confusing `Cannot read properties of undefined`. With it,
the error names the real problem:

```
No customer "john" in customers.json
```

## The checkout workflow

| # | Code | What it does |
|---|---|---|
| 1 | `await this.cartPage.open();` | Open the cart page |
| 2 | `await this.cartPage.checkout();` | Click **Checkout** |
| 3 | `await this.checkoutStepOnePage.assertLoaded();` | Verify step-one page loaded (e.g. URL / header visible) |
| 4 | `await this.checkoutStepOnePage.fillGuest(customer);` | Fill the form from the customer object |
| 5 | `await this.checkoutStepOnePage.continue();` | Click **Continue** |
| 6 | `await this.checkoutStepTwoPage.assertLoaded();` | Verify step-two page loaded |
| 7 | `await this.checkoutStepTwoPage.finish();` | Click **Finish** — order complete |

### Inside `fillGuest(customer)`

Conceptually:

```ts
async fillGuest(customer: CheckoutCustomer) {
    await this.firstName.fill(customer.firstName);
    await this.lastName.fill(customer.lastName);
    await this.postalCode.fill(customer.postalCode);
}
```

```
customer                        form
├── firstName  = Alice    →     First Name  = Alice
├── lastName   = Walker   →     Last Name   = Walker
└── postalCode = 560001   →     Postal Code = 560001
```

## End-to-end flow

```
When I check out as the "alice" customer
        ↓
persona = "alice"
        ↓
customer = customers["alice"]
        ↓
{ firstName: "Alice", lastName: "Walker", postalCode: "560001" }
        ↓
fillGuest(customer)
        ↓
First Name = Alice, Last Name = Walker, Postal Code = 560001
        ↓
continue()
        ↓
finish()
        ↓
Checkout completed
```

## Mental model

`customers.json` is a mini database:

```
customers.json
│
├── alice
│   ├── Alice
│   ├── Walker
│   └── 560001
│
├── bob
│   ├── Bob
│   ├── Singh
│   └── 110011
│
└── carol
    ├── Carol
    ├── Mendes
    └── 400001
```

The feature file supplies the key (`alice`, `bob`, `carol`); the step definition looks it up,
gets the matching `CheckoutCustomer`, and uses it to fill the checkout form. That is the core of
data-driven testing in Playwright + Cucumber.

---

# 6. Data tables — `cart-datatable.spec.ts`

Step definitions in `src/cucumber/level-02-data-driven/steps/cart-datatable.spec.ts`.

**Feature file:**

```gherkin
When I add following products to the cart:
  | productId                    |
  | tta-practice-backpack        |
  | tta-bike-light               |
  | test-allthethings-tshirt-red |
```

**Step definition:**

```ts
import { DataTable, When } from '@cucumber/cucumber';

When(
    'I add following products to the cart:',
    async function (this: CustomWorld, dataTable: DataTable) {
        const products = dataTable.hashes();

        for (const product of products) {
            await this.inventoryPage.addToCart(product.productId);
        }
    }
);
```

## What `hashes()` returns

The first table row becomes the keys; every following row becomes one object:

```ts
[
    { productId: 'tta-practice-backpack' },
    { productId: 'tta-bike-light' },
    { productId: 'test-allthethings-tshirt-red' },
]
```

So `product.productId` gives, one per loop iteration:

```
tta-practice-backpack
tta-bike-light
test-allthethings-tshirt-red
```
