# How to Use the Logger

Winston-backed logging for the TTACart framework. Source: [logger.ts](logger.ts).

## Quick start

```ts
import logger, { createLogger } from '@src/utils/logger';

// framework-wide messages
logger.info('suite started');

// scoped child logger — use the class name as the scope
const log = createLogger('LoginPage');
log.info('clicked #login-button');
// 2026-09-02 07:40:01 [info] [LoginPage] clicked #login-button
```

Default and named imports are the same object — use either:

```ts
import logger from '@src/utils/logger';     // default export
import { logger } from '@src/utils/logger'; // named export
```

## Logging levels

Winston ships with the **npm levels** by default, which is what this logger uses
(no custom `levels` option is passed to `winston.createLogger`). Levels are
ordered by severity — **lower number = more severe**:

| Priority | Level | Use it for | Example |
|---------:|-------|------------|---------|
| 0 | `error`   | Failures that abort the flow: unhandled exceptions, failed API calls, unrecoverable page state. | `logger.error('Login failed after all retries');` |
| 1 | `warn`    | Recoverable oddities: a retry kicked in, a fallback selector was used, a deprecated helper was called. | `logger.warn('Login response was slower than expected');` |
| 2 | `info`    | **Default level.** Business-level milestones. | `logger.info('Login test started');` |
| 3 | `http`    | Request/response traffic — API calls, intercepted network requests. | `logger.http('POST /api/login returned 200');` |
| 4 | `verbose` | Extra detail on top of `info`: resolved config, computed test data, timings. | `logger.verbose('Waiting for the dashboard redirect');` |
| 5 | `debug`   | Developer-only diagnostics: locator strings, raw payloads, intermediate values. | `logger.debug('Login button is visible and enabled');` |
| 6 | `silly`   | Everything else — trace-level dumps you'd never want in CI. | `logger.silly('Password field received 12 characters');` |

### Level filtering

A logger emits a message **only if the message's priority number is `<=` the
logger's configured level**. Set `LOG_LEVEL=warn` and you get `error` + `warn`
only; set `LOG_LEVEL=debug` and you get everything down to `debug` (but not
`silly`).

```bash
# PowerShell
$env:LOG_LEVEL = 'debug'; npm test

# bash / CI
LOG_LEVEL=debug npm test

# a single spec
LOG_LEVEL=debug npx playwright test src/tests/login/login.spec.ts
```

Default is `info` (see [logger.ts:20](logger.ts#L20)), so `http`, `verbose`,
`debug` and `silly` are silent unless you raise the level. Concretely:

- `LOG_LEVEL=error` emits `error` only.
- `LOG_LEVEL=info` emits `info`, `warn`, `error`.
- `LOG_LEVEL=debug` emits `debug`, `verbose`, `http`, `info`, `warn`, `error`.
- `LOG_LEVEL=silly` emits every level.

## Examples per level

### `error` — failure that stops the test

```ts
const log = createLogger('CheckoutStepOnePage');

try {
    await this.continueButton.click();
} catch (err) {
    log.error('continue button never became clickable', err);
    throw err;
}
```

`errors({ stack: true })` is enabled in the format chain, so passing an `Error`
object prints its stack trace:

```ts
log.error(new Error('checkout failed'));   // message + full stack
```

### `warn` — recoverable

```ts
if (!(await this.cartBadge.isVisible())) {
    log.warn('cart badge missing — assuming empty cart');
}
```

### `info` — default, business milestones

```ts
const log = createLogger('LoginPage');
log.info(`logging in as ${username}`);
log.info('login successful');
```

### `http` — network traffic

```ts
const log = createLogger('BookingApi');

page.on('request', (req) => log.http(`--> ${req.method()} ${req.url()}`));
page.on('response', (res) => log.http(`<-- ${res.status()} ${res.url()}`));
```

Invisible at the default `info` level — run with `LOG_LEVEL=http` to see it.

### `verbose` — resolved config / test data

```ts
log.verbose(`baseURL resolved to ${process.env.BASE_URL ?? '(from TTA_ENV)'}`);
log.verbose(`test data: ${JSON.stringify(userData)}`);
```

### `debug` — developer diagnostics

```ts
log.debug(`locator = ${this.loginButton.toString()}`);
log.debug(`response body: ${JSON.stringify(body, null, 2)}`);
```

### `silly` — firehose

```ts
log.silly(`full DOM snapshot: ${await page.content()}`);
```

## Metadata and the `scope` tag

`createLogger(scope)` returns a Winston **child logger** that attaches
`{ scope }` to every line. The custom `printf` formatter renders it as
`[Scope]`:

```ts
const log = createLogger('InventoryPage');
log.info('sorted by price low-to-high');
// 2026-09-02 07:40:03 [info] [InventoryPage] sorted by price low-to-high
```

Any other metadata you pass is accepted by Winston but **not printed** by this
formatter — it only reads `level`, `message`, `timestamp` and `scope`. Put the
detail in the message string:

```ts
// not rendered
log.info('added to cart', { item: 'Sauce Labs Backpack' });

// rendered
log.info('added to cart: Sauce Labs Backpack');
```

## Alternative call styles

All equivalent to `logger.info('...')`:

```ts
logger.log('info', 'suite started');
logger.log({ level: 'info', message: 'suite started' });
```

## Where output goes

Two transports ([logger.ts:35-44](logger.ts#L35-L44)):

- **Console** — colourised level, human-readable.
- **`logs/combined.log`** — plain text, no colour codes; survives the run so CI
  can upload it as an artifact.

Both transports inherit the logger's `level`, so `LOG_LEVEL` controls each.
Every line carries a `YYYY-MM-DD HH:mm:ss` timestamp; scoped loggers add
`[scope]` after the level.

## Choosing a level — rules of thumb

- Page objects: `info` for user-visible actions, `debug` for locator/plumbing detail.
- Never log credentials, tokens, or full request headers — `logs/combined.log`
  is a CI artifact.
- CI default: leave at `info`. Bump to `debug` only when reproducing a failure.
- Don't use `error` for expected negative-test outcomes (a rejected bad login is
  `info`, not `error`).

## Adding custom levels (if ever needed)

The npm levels are the default; a custom set requires passing both `levels` and
`level` to `createLogger`, plus colours for the console:

```ts
const levels = { fatal: 0, error: 1, step: 2, info: 3, debug: 4 };
winston.addColors({ fatal: 'red bold', step: 'cyan' });

export const logger = winston.createLogger({ levels, level: 'info', /* ... */ });
logger.step('navigating to checkout');   // needs a TS declaration merge to typecheck
```

Not currently done in this framework — the npm levels cover the cases above.
