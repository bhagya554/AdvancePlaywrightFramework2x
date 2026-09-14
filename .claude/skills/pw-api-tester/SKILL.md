---
name: pw-api-tester
description: >-
  Designs and generates API tests using Playwright's request context for this
  framework. Use when someone says "write API tests for this endpoint", "test the
  booking API", "add schema validation for this response", "cover the negative
  cases", or pastes an OpenAPI/endpoint spec. Produces happy-path, schema, auth,
  and negative/boundary tests wired to TTA_ENV=api — the engineer runs them.
license: MIT
metadata:
  author: TheTestingAcademy
  pack: playwright
  version: 1.0.0
  adapted-for: AdvancedFramework_2x
---

# PW API Tester

You draft **API tests the engineer must run against a real service** — never a
proven-green suite. You cover the happy path *and* the failure modes testers forget.

## How API testing is wired here

- There is **no separate Playwright project** for API. API suites are a `TTA_ENV`
  value: `npm run test:api` runs `cross-env BASE_URL= TTA_ENV=api playwright test`,
  which points `baseURL` at `restful-booker.herokuapp.com`. The blank `BASE_URL=` is
  load-bearing — without it `.env` pins the host and `TTA_ENV` is dead.
- `src/api/` is still empty (`.gitkeep`). A client layer there is worth building once
  more than two specs share auth; until then, use the `request` fixture directly.
- **Schema validation uses `ajv` + `ajv-formats`**, both already devDependencies.
  Do not reach for `zod` — it is not installed, and adding a dependency to a
  test-only repo needs a reason better than syntax preference.
- `DataGenerator` (Faker) exposes `username`, `password`, `credentials`, `firstName`,
  `lastName`, `postalCode`, `email`, `phone`, `checkoutCustomer`, `userProfile`. There
  is no API-payload helper — compose one from these rather than inventing a method.
- Specs still live under `src/tests/` (`testDir`), e.g. `src/tests/api/`.
- Use plain `request` from `@playwright/test` for API-only specs, or `@fixtures/test-base`
  if the spec also touches a Page Object. Do not pull browser fixtures you do not use.

## Workflow
1. **Extract the contract** — method, path, required headers/auth, request body,
   status codes, response shape. If unknown, ask; do not invent fields.
2. **Design the case matrix:**
   - Happy path (valid request → 2xx + correct body).
   - Schema validation (types and required keys, compiled once with ajv).
   - Auth (missing/expired token → 401/403).
   - Negative and boundary (malformed body → 400, missing field, unknown id → 404,
     wrong method → 405).
3. **Keep auth in one place** — a fixture or `extraHTTPHeaders`, never copy-pasted per
   test. Token values come from `process.env`, never a literal.
4. **Assert precisely** — status, headers, validated body. Never assert exact values
   for generated ids or timestamps; assert their type.
5. **Clean up** anything a test creates.
6. **List assumptions** — base URL, auth source, seed data.

## Output shape
```typescript
import { test, expect } from '@playwright/test';
import Ajv, { type JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';

type Booking = { bookingid: number; booking: { firstname: string; totalprice: number } };

const ajv = addFormats(new Ajv({ allErrors: true }));
const validate = ajv.compile<Booking>({
    type: 'object',
    required: ['bookingid', 'booking'],
    properties: {
        bookingid: { type: 'integer' },
        booking: {
            type: 'object',
            required: ['firstname', 'totalprice'],
            properties: { firstname: { type: 'string' }, totalprice: { type: 'number' } },
        },
    },
} as unknown as JSONSchemaType<Booking>);

test.describe('POST /booking @api', () => {
    test('creates a booking (happy path)', async ({ request }) => {
        const res = await request.post('/booking', {
            data: {                                  // Faker helpers, not literals
                firstname: DataGenerator.firstName(),
                lastname: DataGenerator.lastName(),
                totalprice: 111,
                depositpaid: true,
            },
        });
        expect(res.status()).toBe(200);

        const body = await res.json();
        expect(validate(body), JSON.stringify(validate.errors, null, 2)).toBe(true);
        expect(typeof body.bookingid).toBe('number');   // generated id: type only
    });

    test('rejects delete without auth', async ({ request }) => {
        const res = await request.delete('/booking/1');
        expect(res.status()).toBe(403);
    });
});
```

## Guardrails
- This is a **draft the engineer must run** — `npm run test:api -- src/tests/api/...`.
  Never assume a field, status code, or auth scheme; confirm against the real contract.
- Never fabricate response fields or endpoints. A missing spec is a question, not a guess.
- Never hard-code the API host in a spec — `TTA_ENV=api` supplies `baseURL`. A literal
  host makes the spec unrunnable in every other environment.
- Do not assert exact generated ids or timestamps; assert shape and type.
- Use `ajv`, not `zod`. Compile the schema once at module scope, not per test.
- Clean up created resources; keep auth in a fixture, not inline per test.