// Walkthrough: learnings/2026-09-28-ajv-json-schema-validation.md

import { test, expect } from '@fixtures/booker-fixture'
import { buildBooking } from '@src/testdata/api-booking-data'
import createBookingSchema from '@src/testdata/schemas/create-booking.schema.json'
import { validateSchema } from '@utils/SchemaValidator'
import { createLogger } from '@utils/logger'

const log = createLogger('create-booking-json-schema')

test.describe('@api @schema Create Booking - JSON schema validation (AJV)', () => {
    test('POST /booking response matches the create booking schema', async ({ bookingApi }, testInfo) => {
        const payload = buildBooking()

        const response = await test.step('POST /booking with a generated payload', async () => {
            log.info(`Step 1: Create booking for ${payload.firstname} ${payload.lastname}`)
            const created = await bookingApi.createBooking(payload)
            await testInfo.attach('create-booking-response', {
                body: JSON.stringify(created, null, 2),
                contentType: 'application/json',
            })
            return created
        })

        await test.step('Validate response against JSON schema', async () => {
            log.info(`Step 2: Validate booking ${response.bookingid} against the schema`)
            expect(validateSchema(createBookingSchema, response)).toEqual([])
        })
    })

    test('Schema rejects a response with wrong types, missing fields and bad dates', async () => {
        const brokenResponse = {
            bookingid: 'abc',
            booking: {
                lastname: 'Journey',
                totalprice: 500,
                depositpaid: true,
                bookingdates: { checkin: '01-01-2026', checkout: '2026-01-10' },
            },
        }

        expect(validateSchema(createBookingSchema, brokenResponse)).toEqual(expect.arrayContaining([
            '/bookingid must be integer',
            "/booking must have required property 'firstname'",
            '/booking/bookingdates/checkin must match format "date"',
        ]))
    })
})

/*
Run it using terminal:
npm run test:api -- apiTests/05_ajv_json_schema
*/
