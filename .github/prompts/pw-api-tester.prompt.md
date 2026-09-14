---
mode: agent
description: Generate API tests using Playwright's request context — happy path, ajv schema validation, auth and negative cases, wired to TTA_ENV=api.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW API Tester

Write API tests for: `${input:endpoint:Which endpoint or contract should I cover?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. This
is a **draft the engineer must run against a real service**.

## How API testing is wired here

- **No separate Playwright project.** API is a `TTA_ENV` value: `npm run test:api`
  runs `cross-env BASE_URL= TTA_ENV=api playwright test`, pointing `baseURL` at
  `restful-booker.herokuapp.com`. The blank `BASE_URL=` is load-bearing.
- `src/api/` is still empty. Use the `request` fixture directly until more than two
  specs share auth.
- **Schema validation uses `ajv` + `ajv-formats`** — both already devDependencies.
  **Do not use `zod`; it is not installed.**
- Specs live under `src/tests/`, e.g. `src/tests/api/`.
- Plain `@playwright/test` is fine for API-only specs. Do not pull browser fixtures
  you will not use.

## Workflow

1. **Extract the contract** — method, path, headers/auth, body, status codes,
   response shape. If unknown, ask; do not invent fields.
2. **Design the matrix** — happy path; schema validation; auth (401/403); negative and
   boundary (malformed → 400, missing field, unknown id → 404, wrong method → 405).
3. **Keep auth in one place** — a fixture or `extraHTTPHeaders`, values from
   `process.env`, never a literal.
4. **Assert precisely** — status, headers, validated body. Generated ids and
   timestamps get a **type** assertion, never an exact value.
5. **Clean up** anything a test creates.
6. **Run it** — `npm run test:api -- src/tests/api/<spec>` — and report the real result.

## Shape

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = addFormats(new Ajv({ allErrors: true }));
const validate = ajv.compile({           // compiled once at module scope
    type: 'object',
    required: ['bookingid', 'booking'],
    properties: { bookingid: { type: 'integer' }, booking: { type: 'object' } },
});

test('creates a booking', async ({ request }) => {
    const res = await request.post('/booking', { data: DataGenerator.booking() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(validate(body), JSON.stringify(validate.errors, null, 2)).toBe(true);
});
```

## Do not

- Hard-code the API host in a spec — `TTA_ENV=api` supplies `baseURL`. A literal host
  makes the spec unrunnable in every other environment.
- Fabricate response fields, endpoints, or status codes. A missing spec is a question.
- Assert exact generated ids or timestamps.
- Add `zod` or any other dependency to dodge `ajv` syntax.
- Compile a schema inside a test body.
