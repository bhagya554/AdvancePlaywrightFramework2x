# APIHelper — Full Walkthrough

> **Current state:** `src/utils/APIHelper.ts` is now fully implemented (`ApiHelper`
> class, not `APIHelper`) and passes `npm run typecheck`. This doc walks through the
> real code as it exists in the file, method by method.

---

## 1. Why this class exists

Without a helper, every spec repeats the same boilerplate:

```ts
await request.get(url);
await request.post(url, { data: payload });
```

`APIHelper` wraps that so specs read as intent:

```ts
const api = new APIHelper(request);
await api.get('/users');
```

One class, reused across every API test — same pattern as `BasePage` for UI tests.

---

## 2. The three Playwright types it's built on

```ts
import { Page, APIRequestContext, APIResponse } from '@playwright/test';
```

Step by step:

- **`Page`** — a browser tab. You already use it in UI tests: `page.goto(...)`, `page.click(...)`.
- **`APIRequestContext`** — Playwright's pure HTTP client, no browser involved: `request.get('/users')`. This is what a Playwright API test normally receives as the `request` fixture.
- **`APIResponse`** — what comes back from a call made through `APIRequestContext`: `response.status()`, `response.json()`, etc.

### Why does `ApiContext` include `Page` if this is API testing?

```ts
export type ApiContext = Page | APIRequestContext;
```

This is a **union type** — a variable of this type is allowed to be *either* a `Page`
*or* an `APIRequestContext`.

The reason `Page` is allowed at all: every Playwright `Page` carries its own
`page.request` property, which **is** an `APIRequestContext` under the hood (it shares
cookies/session with that browser tab — useful when you're logged in via UI and want to
fire an API call in the same session). So both of these are meant to work:

```ts
new APIHelper(page);      // UI-context API calls, reuses page's cookies
new APIHelper(request);   // pure API-only context
```

The class's job is to accept either and normalize it into a plain `APIRequestContext`
internally (that's what the `getRequest()` helper method below is for).

---

## 3. The constructor

```ts
constructor(context: ApiContext) {
  this.context = context;
}
```

It does **nothing clever** — it just stores whatever you pass in, unchanged.

```ts
const helper = new APIHelper(page);
// this.context = page  (NOT page.request — no conversion happens here)
```

```ts
const helper = new APIHelper(request);
// this.context = request
```

The conversion to a usable `APIRequestContext` happens later, on demand, inside a
private method — commonly named `getRequest()` — every time a call is made:

```ts
private getRequest(): APIRequestContext {
  if ('request' in this.context) {
    return this.context.request;   // it was a Page → use its .request
  }
  return this.context as APIRequestContext; // it was already an APIRequestContext
}
```

- `'request' in this.context` — a runtime check: does this object have a `request`
  property? True only for `Page`.
- `as APIRequestContext` — a **type assertion**: "trust me, treat this as an
  `APIRequestContext`" (no runtime conversion happens, it's a compile-time-only
  instruction to TypeScript).

So every actual HTTP call in the class should route through `getRequest()`, never touch
`this.context` directly.

---

## 4. `ApiRequestOptions` — the shape of a request

```ts
export interface ApiRequestOptions {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string>;
  timeout?: number;
}
```

This is **not** a built-in Playwright type — it's custom, written for this framework,
so every call into `callApi()` has one predictable shape instead of a long parameter
list.

Field by field:

- `url: string` — required. e.g. `/users`.
- `method: HttpMethod` — required, restricted to `'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'` (that's what `HttpMethod` is — a string literal union, so a typo like `'GTE'` fails at compile time instead of at runtime).
- `headers?: Record<string, string>` — optional (the `?`), e.g. `{ Authorization: 'Bearer xyz' }`.
- `data?: unknown` — optional request body/payload for POST/PUT/PATCH.
- `params?: Record<string, string>` — optional query-string parameters, e.g. `{ page: '2' }`.
- `timeout?: number` — optional per-call timeout override in ms.

### What does `?` mean

`?` marks a property **optional** — the object is valid whether or not you supply it.
`headers?: Record<string, string>` means "you may pass `headers`, or leave it out
entirely; either is fine."

### What does `Record<string, string>` mean

`Record<K, V>` is a built-in TypeScript utility type meaning "an object whose keys are
type `K` and whose values are type `V`." So:

```ts
Record<string, string>
```

means: any object where every key is a string and every value is a string, e.g.

```ts
{ Authorization: 'token123', Accept: 'application/json' }
```

It's shorthand for the index-signature form:

```ts
{ [key: string]: string }
```

---

## 5. `buildUrl()` — attaching query params

```ts
private buildUrl(url: string, params?: Record<string, string>): string {
  if (!params) return url;
  const searchParams = new URLSearchParams(params);
  return `${url}?${searchParams.toString()}`;
}
```

Purpose: turn a params object into a proper query string and append it to the URL.

Input:

```ts
buildUrl('https://reqres.in/api/users', { page: '2', status: 'active' })
```

Output:

```
https://reqres.in/api/users?page=2&status=active
```

### What is `URLSearchParams`

It's a **built-in JavaScript/browser/Node API**, not something Playwright or this
framework invented. Give it an object (or string, or array of pairs) and it knows how to
serialize it into `key=value&key2=value2` format, handling URL-encoding for you (spaces
become `%20`, `&` inside a value gets escaped, etc.). Think of it as a translator from
a plain JS object to a valid URL query string — `buildUrl()` just uses it and appends
the `?`.

---

## 6. `callApi()` — the one method everything else calls

```ts
async callApi(options: ApiRequestOptions): Promise<APIResponse> {
  const { url, method, headers, data, params, timeout } = options;
  const request = this.getRequest();
  const fullUrl = this.buildUrl(url, params);

  switch (method) {
    case 'GET':    return await request.get(fullUrl, { headers, timeout });
    case 'POST':   return await request.post(fullUrl, { headers, data, timeout });
    case 'PUT':    return await request.put(fullUrl, { headers, data, timeout });
    case 'DELETE': return await request.delete(fullUrl, { headers, timeout });
    case 'PATCH':  return await request.patch(fullUrl, { headers, data, timeout });
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
}
```

The `default` branch is dead code today — `HttpMethod` only allows the five listed
strings, so TypeScript already blocks anything else at compile time. It's a defensive
fallback in case `HttpMethod` grows a new value later without every `case` being
updated, or the method arrives from untyped/`any` input at runtime.

Step by step:

1. `options: ApiRequestOptions` — TypeScript enforces the caller passes an object
   matching that interface's shape.
2. **Destructuring** — `const { url, method, headers, data, params, timeout } = options;`
   pulls each field out into its own local variable, equivalent to writing
   `options.url`, `options.method`, etc. individually but shorter.
3. `getRequest()` — normalizes `this.context` (whether it was constructed from a `Page`
   or an `APIRequestContext`) into a plain `APIRequestContext` to call methods on.
4. `buildUrl()` — appends `params` as a query string, if any were given.
5. `switch (method)` — picks which underlying Playwright method to call based on the
   `HttpMethod` string.
6. Each branch calls the real Playwright request method (`request.get/post/put/delete/patch`)
   and returns its result — which is a `Promise<APIResponse>`.

### `get()` / `post()` / `put()` / `delete()` / `patch()` — the convenience wrappers

These are thin methods whose whole job is to build an `ApiRequestOptions` object and
hand it to `callApi()`, so callers don't have to write the object literal every time.
The real implementation:

```ts
async get(url: string, options?: Omit<ApiRequestOptions, 'url' | 'method'>): Promise<APIResponse> {
  return this.callApi({ url, method: 'GET', ...options });
}

async post(url: string, data?: unknown, options?: Omit<ApiRequestOptions, 'url' | 'method' | 'data'>): Promise<APIResponse> {
  return this.callApi({ url, method: 'POST', data, ...options });
}
```

(`put()` and `patch()` mirror `post()`; `delete()` mirrors `get()`.)

Two things worth calling out that differ from a naive version:

- **`Omit<ApiRequestOptions, 'url' | 'method'>`** — a built-in TypeScript utility type
  meaning "take the `ApiRequestOptions` shape and remove these keys." Since `get()`
  already fixes `url` and `method` as its own parameters, the caller shouldn't be able
  to pass them again through `options` (that would be redundant and could conflict) —
  `Omit` strips them out of the allowed type. What's left the caller *can* still pass:
  `headers`, `params`, `timeout` (and `data` too, for `get`/`delete`, unusual but not
  disallowed).
- **`...options`** — the spread operator. It copies every remaining property from
  `options` (e.g. `headers`, `params`, `timeout`) into the object literal being built,
  so instead of listing each one by name (`headers, params, timeout`) they all pass
  through in one go.

Usage:

```ts
api.get('/users');
// → callApi({ url: '/users', method: 'GET' })

api.get('/users', { params: { page: '2' } });
// → callApi({ url: '/users', method: 'GET', params: { page: '2' } })

api.post('/users', { name: 'John' });
// → callApi({ url: '/users', method: 'POST', data: { name: 'John' } })

api.post('/users', { name: 'John' }, { headers: { Authorization: 'Bearer xyz' } });
// → callApi({ url: '/users', method: 'POST', data: { name: 'John' }, headers: {...} })
```

### What `Promise<APIResponse>` means

An HTTP response doesn't arrive instantly, so instead of returning an `APIResponse`
directly, the method returns a **placeholder** — a `Promise<APIResponse>` — that means
"I will hand you an `APIResponse` once the network call finishes." `await` is what
unwraps that placeholder into the actual `APIResponse`:

```
Promise<APIResponse>  --await-->  APIResponse
```

---

## 7. `parseJsonResponse<T>()` — typed JSON parsing

```ts
async parseJsonResponse<T>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}
```

`response.json()` on its own returns `any` — TypeScript has no idea what shape the JSON
body actually has. `<T>` is a **generic type parameter**: a placeholder type you fill in
at the call site so the result comes back strongly typed instead of `any`.

```ts
interface User {
  id: number;
  name: string;
}

const user = await api.parseJsonResponse<User>(response);
```

Here `T` becomes `User` for this one call, so `user.name` autocompletes and typos are
caught at compile time.

- `Promise<T>` — same idea as `Promise<APIResponse>` above, just generic: "eventually
  resolves to whatever type `T` was filled in as."
- `as T` — a type assertion again: TypeScript can't verify the JSON actually matches
  `User` at compile time (it doesn't inspect runtime data), so this says "trust me,
  treat this parsed JSON as a `User`." It's a contract you're responsible for keeping
  true — if the API sends a different shape, this won't catch it; only real assertions
  in the test will.

---

## 8. Retry logic — kept separate, as requested

```ts
export interface RetryOptions {
  condition: (response: APIResponse) => Promise<boolean> | boolean;
  pollingInterval?: number;
  retryCount?: number;
}
```

`condition` returns `Promise<boolean> | boolean` — another union type — because the
caller might need to `await response.json()` to decide (async), or might just check
`response.status()` synchronously. Allowing either means `callApiWithRetry` always
`await`s the result (`await` on a plain non-promise value is a no-op, so it's safe
either way).

Real implementation:

```ts
async callApiWithRetry(
  options: ApiRequestOptions,
  retryOptions: RetryOptions,
): Promise<APIResponse> {
  const { condition, pollingInterval = 5000, retryCount = 3 } = retryOptions;
  let lastResponse: APIResponse | null = null;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    lastResponse = await this.callApi(options);

    if (await condition(lastResponse)) {
      return lastResponse;
    }

    if (attempt < retryCount) {
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }
  }

  return lastResponse!;
}
```

Purpose: some APIs are eventually-consistent (e.g. a job that starts `202 pending` and
later becomes `200 done`) — this polls until `condition(response)` is true or the
attempt budget (`retryCount`, default `3`) runs out, waiting `pollingInterval` ms
(default `5000`) between attempts.

Notes on the mechanics:

- `lastResponse!` — the `!` is the **non-null assertion operator**. TypeScript sees
  `lastResponse: APIResponse | null` and can't prove it's non-null by the time the loop
  exits, but the loop always runs at least once (`attempt <= retryCount` with
  `retryCount >= 1`), so it's always been assigned. `!` tells the compiler "trust me,
  this isn't null here."
- `if (attempt < retryCount)` before the wait — skips the pointless final sleep after
  the last attempt has already failed.
- If every attempt fails the condition, the last (still-failing) response is returned
  rather than throwing — the caller is expected to assert on it and get a clear
  failure message, instead of the retry helper swallowing the real error into a generic
  timeout exception.

Example call:

```ts
api.callApiWithRetry(
  { url: '/status', method: 'GET' },
  {
    retryCount: 3,
    pollingInterval: 2000,
    condition: (response) => response.status() === 200,
  }
);
```

Flow:

```
Attempt 1 → GET /status → 404 → condition false → wait 2s
Attempt 2 → GET /status → 404 → condition false → wait 2s
Attempt 3 → GET /status → 200 → condition true  → return response
```

---

## 9. Status-check helpers

```ts
isSuccess(response: APIResponse): boolean {
  const status = response.status();
  return status >= 200 && status < 300;
}

isFailureClient(response: APIResponse): boolean {
  const status = response.status();
  return status >= 400 && status < 500;
}
```

Small, non-async, plain boolean checks — no `Promise`/`await` needed since
`response.status()` is synchronous (the status code was already read off the response
headers, unlike the body which `response.json()` has to stream/parse). Handy both as
spec assertions (`expect(api.isSuccess(response)).toBe(true)`) and as `condition`
functions for `callApiWithRetry`:

```ts
api.callApiWithRetry(options, { condition: (r) => api.isSuccess(r) });
```

---

## 10. Full call chain, end to end

```
new APIHelper(page | request)
        ↓
  get()/post()/put()/delete()/patch()   (build an ApiRequestOptions)
        ↓
      callApi()
        ↓
   getRequest()          buildUrl()
   (normalize context)   (attach ?params)
        ↓
 request.get/post/put/delete/patch(fullUrl, { headers, data, timeout })
        ↓
     APIResponse
        ↓
 parseJsonResponse<T>()   ← optional, only if you need a typed object
        ↓
     Typed result
```

---

## 11. Quick revision

| Symbol | Meaning |
|---|---|
| `Page` | Browser tab handle |
| `APIRequestContext` | Playwright's pure HTTP client |
| `APIResponse` | Result of an HTTP call |
| `ApiContext` | `Page \| APIRequestContext` — either is accepted by the constructor |
| `ApiRequestOptions` | Custom interface describing one request's shape |
| `Record<string, string>` | Object with string keys and string values |
| `?` on a field | Optional — may be omitted |
| `getRequest()` | Normalizes `this.context` into a plain `APIRequestContext` |
| `buildUrl()` | Appends `params` as a `?key=value&...` query string via `URLSearchParams` |
| `callApi()` | Central executor — routes to `request.get/post/put/delete/patch` |
| `get/post/put/delete/patch()` | Thin wrappers that build options and call `callApi()` |
| `Promise<APIResponse>` | "An `APIResponse` will be available later" |
| `parseJsonResponse<T>()` | Parses `response.json()` and asserts it as type `T` |
| `callApiWithRetry()` | Polls `callApi()` until a condition passes or attempts run out |
| `isSuccess()` / `isFailureClient()` | Quick boolean checks on `response.status()` |
