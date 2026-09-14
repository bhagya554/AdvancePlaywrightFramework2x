# Adding `.env` Support — Approach, Questions, and Outcome

How environment-driven configuration was added to
[e2e-checkout-env.spec.ts](../src/tests/e2e/e2e-checkout-env.spec.ts), the
questions that shaped it, and the traps found along the way.

Written as a worked example: the *reasoning* matters more than the diff, because
two of the decisions here are counter-intuitive and easy to get wrong again.

---

## 1. The ask

> "I want to add Dot Env support for this file where I want to get the data from
> the `.env` file. Let me know what are the libraries that we can use... Make
> sure it uses minimal code changes."

Two questions inside one request:

1. **Which library?**
2. **What are the minimum changes to this one file?**

A follow-up constrained it further:

> "Use TTA related username and password, not the Windows one."

---

## 2. First question: which library?

**Answer: none. Nothing to install.**

The instinct is to `npm i dotenv` and call `dotenv.config()` at the top of the
spec. Both steps were already unnecessary:

- `dotenv@17.4.2` is already a `devDependency` in [package.json](../package.json).
- It is already invoked once, at [playwright.config.ts:4](../playwright.config.ts#L4):

```ts
dotenv.config();
```

Playwright workers load the config file **before** any spec module, so
`process.env` is fully populated by the time a spec's top-level code runs.

> **Do not call `dotenv.config()` inside a spec.** dotenv never overwrites an
> existing key, so a second call is a no-op at best. It also creates the false
> impression that each file loads its own environment.

Evidence: the runner prints `injected env (12) from .env` on every run — that is
dotenv reporting what it loaded, in the config, before tests started.

---

## 3. The trap: `USERNAME` cannot be used on Windows

`.env` originally carried:

```
USERNAME=admin
PASSWORD=ADMIN123
```

Neither worked as intended, and one of them *cannot*:

Windows sets `process.env.USERNAME` for every process. dotenv does not overwrite
existing keys. So the `.env` value is silently discarded.

Measured directly:

```powershell
node -e "console.log(process.env.USERNAME)"
# 91733        <- the Windows account, not "admin"
```

Confirmed a second way: the file had **13** keys but the runner logged
`injected env (12)`. Exactly one key was skipped — `USERNAME`.

This is the worst class of config bug. Nothing errors. Nothing warns. A test
just silently authenticates as the wrong user.

**Rule: never name an env key `USERNAME`.** Prefix project variables (`TTA_*`,
`STANDARD_USER`) so they cannot collide with OS variables.

Both lines were also dead — no source file read either name.

---

## 4. Second question: which key names?

Three naming schemes existed in the repo at once:

| Location | Names | Status |
|---|---|---|
| `.env` | `USERNAME` / `PASSWORD` | Read by nothing; `USERNAME` unusable |
| `.env.example` | `USER_NAME` / `PASSWORD` | Read by nothing |
| [credentials.ts](../src/config/credentials.ts) | `STANDARD_USER` / `TTA_SECRET` | **Actually read by code** |

The temptation was to invent a fourth (`TTA_USERNAME` / `TTA_PASSWORD`). That
would have been the wrong call — more names, more drift.

**Decision: adopt the names the code already reads.** `STANDARD_USER` and
`TTA_SECRET` are TTA-specific, collision-free, and already wired up:

```ts
standardUser: process.env.STANDARD_USER ?? 'standard_user',
```

Consequence: **credentials needed zero code change.** They became
environment-driven the moment those keys existed in `.env`. Only the product ID
needed a new key, `TTA_ITEM_ID`.

The lesson generalises: before adding configuration, check what the code already
reads. Half the work here was deleting a problem rather than building a solution.

---

## 5. Files touched

| File | Change |
|---|---|
| [.env](../.env) | Added `STANDARD_USER`, `TTA_SECRET`, `TTA_ITEM_ID`; deleted dead `USERNAME` / `PASSWORD` |
| [.env.example](../.env.example) | Same three keys, replacing the `USER_NAME` / `PASSWORD` pair that matched nothing |
| [e2e-checkout-env.spec.ts](../src/tests/e2e/e2e-checkout-env.spec.ts) | Read `TTA_ITEM_ID`; log what resolved |
| [src/config/env.ts](../src/config/env.ts) | **New** — shared env readers (added in the follow-up refactor, §7) |
| [credentials.ts](../src/config/credentials.ts) | Switched `??` to `env()` so a blank value falls back (§7) |

Untouched: `package.json`, `playwright.config.ts`, all page objects, all
fixtures.

---

## 6. The blank-value rule

Every reader treats a **blank** value as unset:

```ts
const value = process.env[key]?.trim();
return value ? value : undefined;
```

Not a stylistic choice — it mirrors [playwright.config.ts:7](../playwright.config.ts#L7):

```ts
if (process.env.BASE_URL) return process.env.BASE_URL;
```

That truthiness check is what makes `cross-env BASE_URL= TTA_ENV=stg` work: the
blank value is falsy, so resolution falls through to `TTA_ENV`. Env readers that
treat `""` as a real value would break that pattern.

> **PowerShell caveat:** `$env:FOO=""` and `$env:FOO=$null` both *delete* the
> variable — after which dotenv refills it from `.env`. To override a `.env`
> value from PowerShell you must set a real string: `$env:FOO="false"`.

---

## 7. Follow-up: extracting the utility

> "Can we create a utility which can help us or make it more modular in nature
> and optimize it more with minimum changes?"

The first pass put a local `fromEnv()` helper in the spec — fine for one file,
duplication waiting to happen across many. It moved to
[src/config/env.ts](../src/config/env.ts):

| Function | Purpose |
|---|---|
| `env(key, fallback)` | Value or default |
| `requireEnv(key)` | Throws, naming the key and pointing at `.env.example` |
| `envFlag(key, fallback?)` | `true` / `1` / `yes`, case-insensitive |
| `envNumber(key, fallback)` | Falls back on unparseable input |

Placed in `src/config/` beside `credentials.ts` (same job — resolving
configuration), not `src/utils/`. `@config/*` was already aliased in
[tsconfig.json](../tsconfig.json), so no config change was needed.

`credentials.ts` then moved from `??` to `env()`. Subtle but real: `??` only
falls back on `null`/`undefined`, so a blank `STANDARD_USER=` in `.env` would
hand tests an **empty username**. `env()` treats blank as unset.

Spec after both passes:

```ts
import { env } from '@config/env';

const FIRST_ITEM_ID = env('TTA_ITEM_ID', 'test-allthethings-tshirt-red');
```

---

## 8. Verification — and why a passing test proved nothing

A green run does **not** show the env value is being used. A spec that ignores
`.env` and falls back to its hard-coded default also passes.

So the suite was checked four ways:

| Check | Command | Expected |
|---|---|---|
| Baseline | `npx playwright test src/tests/e2e/e2e-checkout-env.spec.ts` | Passes; logs `item=test-allthethings-tshirt-red` |
| Shell beats `.env` | `$env:TTA_ITEM_ID="tta-fleece-jacket"; npx playwright test …` | Logs `item=tta-fleece-jacket` |
| **Value truly in use** | `$env:TTA_ITEM_ID="false-id"; npx playwright test …` | **Fails** at `add-to-cart-false-id` |
| Blank falls back | `$env:STANDARD_USER="   "; npx playwright test …` | Logs `user=standard_user` |

The third row is the one that matters. Actual output:

```
waiting for locator('[data-test="add-to-cart-false-id"]')
1 failed
```

A deliberate failure is what distinguishes "the config is wired" from "the
fallback is doing all the work". Design at least one check that *must* fail.

Full suite after all changes: **18 passed**, typecheck clean.

---

## 9. Making the resolved config visible

One line in `beforeEach` prints what actually resolved, into both the terminal
and the custom HTML report:

```ts
log.info(`Env: user=${credentials.standardUser} item=${FIRST_ITEM_ID} baseURL=${test.info().project.use.baseURL}`);
```

```
Env: user=standard_user item=test-allthethings-tshirt-red baseURL=https://app.thetestingacademy.com
```

Environment bugs are invisible by nature — a run against the wrong host looks
identical to a correct one until something fails oddly. Logging resolved
configuration makes "which environment was this?" answerable from the report
instead of by re-deriving precedence rules.

---

## 10. Takeaways

1. **Check what is already installed and already called.** The answer to "which
   library" was "the one you have, already wired".
2. **Never name an env key `USERNAME`.** It is shadowed by the OS on Windows and
   fails silently. Prefix project keys.
3. **Reuse the names your code already reads** before inventing new ones. Here it
   reduced the change to zero lines for credentials.
4. **Blank means unset.** It matches `resolveBaseURL()` and keeps the
   `cross-env VAR=` override pattern working.
5. **Prove the config is live with a failure**, not a pass.
6. **Log what resolved.** Silent misconfiguration is the expensive kind.

---

## Related

- [.env.example](../.env.example) — every supported key
- [src/config/env.ts](../src/config/env.ts) — the readers
- [playwright.config.ts](../playwright.config.ts) — `dotenv.config()` and `resolveBaseURL()`
- [CLAUDE.md](../CLAUDE.md) — `baseURL` precedence and the `BASE_URL` pin gotcha
