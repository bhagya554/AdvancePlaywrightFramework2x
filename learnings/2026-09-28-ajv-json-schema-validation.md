# Validating the Create Booking response with AJV JSON Schema

## The goal

Field-by-field checks like `expect(booking.firstname).toBe(...)` confirm values, but they
don't catch a broken response *shape*. For example, `bookingid` could come back as a string,
a field could go missing, a date could arrive in the wrong format, or the API could start
sending extra fields. A JSON Schema describes the whole contract once, and AJV checks every
response against it in a single call.

## Files involved

| File | Role |
|---|---|
| `src/testdata/schemas/create-booking.schema.json` | The schema: what a valid `POST /booking` response looks like |
| `src/utils/SchemaValidator.ts` | Shared `validateSchema()` function that any spec can use |
| `src/tests/apiTests/05_ajv_json_schema/create-booking-json-schema.spec.ts` | The tests |

No install was needed: `ajv` and `ajv-formats` were already in `devDependencies`, and
`tsconfig.json` already had `resolveJsonModule: true`, so a `.json` schema can be imported directly.

## Step 1: Write the schema from a real response

Start from an actual response body:

```json
{
  "bookingid": 3940,
  "booking": {
    "firstname": "Antoinette",
    "lastname": "Runolfsdottir",
    "totalprice": 512,
    "depositpaid": true,
    "bookingdates": { "checkin": "2026-01-01", "checkout": "2026-01-20" },
    "additionalneeds": "Breakfast"
  }
}
```

Then turn it into a schema using these rules:

1. **Every key becomes an entry under `properties`** with its `type` (`string`, `number`,
   `integer`, `boolean`, `object`, `array`).
2. **List the mandatory keys in `required`.** `additionalneeds` is left out because
   restful-booker treats it as optional.
3. **Nested objects repeat the same pattern.** `booking` and `bookingdates` each get their
   own `type`, `properties` and `required`.
4. **Tighten values where it matters:**
   - `bookingid`: `"type": "integer", "minimum": 1`, so it must be a positive whole number
   - names: `"minLength": 1`, so empty strings are rejected
   - dates: `"format": "date"`, so they must be `YYYY-MM-DD` (needs `ajv-formats`)
5. **Add `"additionalProperties": false`** at each level, so the test fails if the API
   starts returning fields we don't know about.
6. **Add a `$id`** (`"create-booking-response"`). It names the schema, and other schemas can reference it by that name.

The full schema is in `src/testdata/schemas/create-booking.schema.json`.

## Step 2: Build one reusable validator

```ts
import Ajv, { type AnySchema } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export function validateSchema(schema: AnySchema, data: unknown): string[] {
    const validate = ajv.compile(schema);
    return validate(data)
        ? []
        : (validate.errors ?? []).map(e => `${e.instancePath || '(root)'} ${e.message}`);
}
```

Why it looks like this:

- **One shared `Ajv` instance.** Compiling a schema is the slow part. AJV caches compiled
  schemas, so later validations are cheap.
- **`allErrors: true`.** Reports every problem, not just the first one, so one run shows everything that is wrong.
- **`addFormats(ajv)`.** Without it, AJV doesn't recognise `"format": "date"`.
- **Plain `compile(schema)` on every call.** AJV caches by schema object, and a JSON import is
  always the same object, so only the first call compiles. Caveat: compiling two *different*
  objects with the same `$id` throws "schema already exists", so don't build schemas on the fly.
- **Returns `string[]`, not `boolean`.** An empty array means valid. In the spec,
  `expect(errors).toEqual([])` prints the exact failing field in the report
  (e.g. `/booking/totalprice must be number`). A boolean would only print `expected true, received false`.

## Step 3: Use it in the spec

**Positive test:** create a real booking, then validate the response:

```ts
const created = await bookingApi.createBooking(buildBooking())
expect(validateSchema(createBookingSchema, created)).toEqual([])
```

This reuses what the framework already has: the `bookingApi` fixture from
`@fixtures/booker-fixture` and `buildBooking()` from `@src/testdata/api-booking-data`.

**Negative test:** prove the schema actually catches problems. Feed it a deliberately broken
object (no network call) and assert that the expected errors come back:

```ts
const brokenResponse = {
    bookingid: 'abc',                     // wrong type
    booking: {
        // firstname missing
        lastname: 'Journey', totalprice: 500, depositpaid: true,
        bookingdates: { checkin: '01-01-2026', checkout: '2026-01-10' }, // bad date format
    },
}

expect(validateSchema(createBookingSchema, brokenResponse)).toEqual(expect.arrayContaining([
    '/bookingid must be integer',
    "/booking must have required property 'firstname'",
    '/booking/bookingdates/checkin must match format "date"',
]))
```

A schema that never fails is useless. The negative test guards against a schema that is too loose,
for example one where a typo in `required` makes every check pass.

## Step 4: Run it

```bash
npm run typecheck
npm run test:api -- apiTests/05_ajv_json_schema
```

Result: 2 passed. The created booking JSON is attached to the HTML report (`npm run report`).

## Reading AJV error messages

| Message | Meaning |
|---|---|
| `/bookingid must be integer` | Wrong type at that path |
| `/booking must have required property 'firstname'` | Missing key (the path is the *parent* object) |
| `/booking/bookingdates/checkin must match format "date"` | Right type, wrong format |
| `/booking must NOT have additional properties` | The API returned an extra field |
| `(root) must be object` | The whole body isn't an object (e.g. an HTML error page) |

## The reusable rule

**Schema checks the shape, `expect` checks the values. Use both.** To validate a new
endpoint, add one `.json` file under `src/testdata/schemas/` and call the same
`validateSchema()`. The utility never needs to change.
