import { test, expect } from '@fixtures/booker-fixture'
import { buildBooking } from '@src/testdata/api-booking-data'
import { createLogger } from '@src/utils/logger'

const log = createLogger('booking-negative-e2e-fixtures')

test.describe.serial('@e2e @P1 Level 3 - Booking negative scenarios (token from fixture)', () => {
    let bookingId: number;

    test('Create Booking (setup for negative auth scenarios)', async ({ bookingApi }, testInfo) => {
        const payload = buildBooking({ firstname: "Negative", lastname: "Scenario" })

        await test.step("POST /booking with a generated payload", async () => {
            log.info(`Step 1: Create booking for ${payload.firstname} and ${payload.lastname}`)
            const { bookingid, booking } = await bookingApi.createBooking(payload);

            log.info(`Step 2: Extract the bookingId and verify the create booking response`)
            expect(bookingid).toBeGreaterThan(0);
            expect(booking.firstname).toBe(payload.firstname);
            bookingId = bookingid;

            await testInfo.attach('created-booking', {
                body: JSON.stringify({ bookingid, booking }, null, 2),
                contentType: 'application/json',
            });
        })
    })

    test('GET Booking with a non-existent bookingId returns 404', async ({ bookingApi }, testInfo) => {
        const invalidBookingId = 999999999;

        await test.step(`GET /booking/${invalidBookingId}`, async () => {
            log.info(`Step 1: Request booking ${invalidBookingId} that does not exist`);
            const response = await bookingApi.getBookingResponse(invalidBookingId);

            log.info(`Step 2: verify the response status is 404`)
            expect(response.status()).toBe(404);

            await testInfo.attach('get-nonexistent-booking', {
                body: JSON.stringify({ status: response.status() }, null, 2),
                contentType: 'application/json',
            });

            log.info(`Step 3: GET booking ${invalidBookingId} returns 404 as expected`);
        })
    })

    test('POST /auth with bad credentials returns no token', async ({ bookingApi }, testInfo) => {
        await test.step('POST /auth with wrong username/password', async () => {
            log.info('Step 1: Request auth token with invalid credentials');
            const response = await bookingApi.getAuthResponse('invalid_user', 'wrong_password');
            const body = await response.json();

            log.info('Step 2: verify no token is issued and reason is Bad credentials')
            expect(response.status()).toBe(200);
            expect(body.token).toBeUndefined();
            expect(body.reason).toBe('Bad credentials');

            await testInfo.attach('bad-credentials-auth', {
                body: JSON.stringify(body, null, 2),
                contentType: 'application/json',
            });
        })
    })

    test('PUT /booking with missing/invalid token is rejected', async ({ bookingApi }, testInfo) => {
        const updatedPayload = buildBooking({ firstname: "ShouldNot", lastname: "Update" })

        await test.step(`PUT /booking/${bookingId} using an invalid token`, async () => {
            log.info(`Step 1: Attempt to update booking ${bookingId} using invalid token`);
            const response = await bookingApi.updateBookingResponse(bookingId, updatedPayload, 'invalid-token-value');

            log.info(`Step 2: verify the response is rejected (403/401)`)
            expect([401, 403]).toContain(response.status());

            await testInfo.attach('update-invalid-token', {
                body: JSON.stringify({ status: response.status() }, null, 2),
                contentType: 'application/json',
            });

            log.info(`Step 3: verify booking ${bookingId} was not modified`);
            const fetched = await bookingApi.getBooking(bookingId);
            expect(fetched.firstname).not.toBe(updatedPayload.firstname);
        })
    })

    test('DELETE /booking with missing/invalid token is rejected', async ({ bookingApi }, testInfo) => {
        await test.step(`DELETE /booking/${bookingId} using an invalid token`, async () => {
            log.info(`Step 1: Attempt to delete booking ${bookingId} using invalid token`);
            const response = await bookingApi.deleteBookingResponse(bookingId, 'invalid-token-value');

            log.info(`Step 2: verify the response is rejected (403/401)`)
            expect([401, 403]).toContain(response.status());

            await testInfo.attach('delete-invalid-token', {
                body: JSON.stringify({ status: response.status() }, null, 2),
                contentType: 'application/json',
            });

            log.info(`Step 3: verify booking ${bookingId} still exists`);
            const getBooking = await bookingApi.getBookingResponse(bookingId);
            expect(getBooking.status()).toBe(200);
        })
    })
})

/*
Run via terminal:
npm run test:api -- src/tests/apiTests/03_restfulbooker_fixture_e2e_api/booking-negative-e2e-fixtures.spec.ts
*/