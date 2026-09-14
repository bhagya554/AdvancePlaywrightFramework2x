import { test, expect } from '@fixtures/booker-fixture'
import { buildBookingFromDataGenerator } from '@src/testdata/api-booking-data'
import { createLogger } from '@src/utils/logger'

const log = createLogger('booking-partial-update-datagenerator')

test.describe.serial('@e2e @P1 Level 3 - Partial booking update (data via DataGenerator)', () => {
    let bookingId: number;

    test('Create Booking (payload from DataGenerator)', async ({ bookingApi }, testInfo) => {
        const payload = buildBookingFromDataGenerator()

        await test.step('POST /booking with a DataGenerator payload', async () => {
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

    test('Partial update Booking(token comes from fixtures) and Get Booking Details', async ({ bookingApi, bookerToken }, testInfo) => {
        const patchPayload = buildBookingFromDataGenerator({ additionalneeds: 'Airport shuttle' })

        await test.step(`PATCH /booking/${bookingId} using fixture token`, async () => {
            log.info(`Step 1: Partially update booking ${bookingId} using fixture token`);
            const patched = await bookingApi.partialUpdateBooking(bookingId, patchPayload, bookerToken);

            log.info(`Step 2: verify the patched booking response`)
            expect(patched.firstname).toBe(patchPayload.firstname);
            expect(patched.lastname).toBe(patchPayload.lastname);
            expect(patched.additionalneeds).toBe('Airport shuttle');

            await testInfo.attach('patched-booking', {
                body: JSON.stringify(patched, null, 2),
                contentType: 'application/json',
            });
        })

        await test.step(`GET /booking/${bookingId}`, async () => {
            log.info(`Step 1: Get booking ${bookingId} details`);
            const fetched = await bookingApi.getBooking(bookingId);

            log.info(`Step 2: verify the booking details`)
            expect(fetched.additionalneeds).toBe('Airport shuttle');

            await testInfo.attach('get-booking', {
                body: JSON.stringify(fetched, null, 2),
                contentType: 'application/json',
            });

            log.info(`Step 3: GET booking ${bookingId} request is SUCCESS`);
        })
    })

    test('Delete Booking(token comes from fixtures) and Verify that the booking has been deleted', async ({ bookingApi, bookerToken }, testInfo) => {

        await test.step(`DELETE /booking/${bookingId} using fixture token`, async () => {
            log.info(`Step 1: DELETE booking ${bookingId} using fixture token`);
            const status = await bookingApi.deleteBooking(bookingId, bookerToken);

            log.info(`Step 2: verify the delete booking status code ${status}`)
            expect(status).toBe(201);

            await testInfo.attach('delete-booking', {
                body: JSON.stringify(status, null, 2),
                contentType: 'application/json',
            });
        })

        await test.step(`GET /booking/${bookingId} should now return 404`, async () => {
            log.info(`Step 1: Confirm booking ${bookingId} has been deleted(expect 404)`);
            const getBooking = await bookingApi.getBookingResponse(bookingId);
            expect(getBooking.status()).toBe(404)
            log.info(`Step 2: booking ${bookingId} returns 404 as expected`);
        })
    })
})
