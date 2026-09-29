import { test, expect } from '@fixtures/booker-fixture'
import { buildBooking } from '@src/testdata/api-booking-data'

test.describe.serial('@e2e @P0 Level 3 - Booking lifecycle (token from fixture)', () => {
    let bookingId: number

    test('Create Booking', async ({ bookingApi }) => {
        const payload = buildBooking({ firstname: 'Created', lastname: 'Journey' })
        const { bookingid, booking } = await bookingApi.createBooking(payload)
        expect(bookingid).toBeGreaterThan(0)
        expect(booking).toEqual(payload)
        bookingId = bookingid
    })

    test('Update Booking(token comes from fixtures) and Get Booking Details', async ({ bookingApi, bookerToken }) => {
        const updatedPayload = buildBooking({ firstname: 'Updated', lastname: 'Journey', totalprice: 5000 })

        await test.step(`PUT /booking/${bookingId}`, async () => {
            expect(await bookingApi.updateBooking(bookingId, updatedPayload, bookerToken)).toEqual(updatedPayload)
        })

        await test.step(`GET /booking/${bookingId}`, async () => {
            expect(await bookingApi.getBooking(bookingId)).toEqual(updatedPayload)
        })
    })

    test('Delete Booking(token comes from fixtures) and Verify that the booking has been deleted', async ({ bookingApi, bookerToken }) => {
        await test.step(`DELETE /booking/${bookingId}`, async () => {
            expect(await bookingApi.deleteBooking(bookingId, bookerToken)).toBe(201)
        })

        await test.step(`GET /booking/${bookingId} should now return 404`, async () => {
            expect((await bookingApi.getBookingResponse(bookingId)).status()).toBe(404)
        })
    })
})

// npm run test:api -- apiTests/03_restfulbooker_fixture_e2e_api/booking-crud-e2e-fixtures-ponytailReviewed.spec.ts
