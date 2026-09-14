import { test, expect } from '@fixtures/booker-fixture'
import { buildBooking } from '@src/testdata/api-booking-data'
import { createLogger } from '@src/utils/logger'

const log = createLogger('booking-crud-e2e-fixtures')

test.describe.serial('@e2e @P0 Level 3 - Booking lifecycle (token from fixture)', () => {
    let bookingId: number;
    
    test('Create Booking', async ({ bookingApi }, testInfo) => {
        const payload = buildBooking({ firstname: "Created", lastname: "Journey" })

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

    
    test('Update Booking(token comes from fixtures) and Get Booking Details',async ({bookingApi,bookerToken},testInfo)=>{
        const updatedpayload=buildBooking({firstname:"Updated",lastname:"Journey",totalprice:5000})
        await test.step(`PUT /booking/${bookingId} using fixture token`,async ()=>{
            log.info(`Step 1: Update booking ${bookingId} using fixture token`);
            const updated=await bookingApi.updateBooking(bookingId,updatedpayload,bookerToken);

            log.info(`Step 2: verify the updated booking response`)
            expect(updated.firstname).toBe(updatedpayload.firstname);
            expect(updated.lastname).toBe(updatedpayload.lastname);
            expect(updated.totalprice).toBe(updatedpayload.totalprice);
           
            await testInfo.attach('updated-booking', {
                body: JSON.stringify(updated, null, 2),
                contentType: 'application/json',
            });
        })

        await test.step(`GET /booking/${bookingId}`,async ()=>{
            log.info(`Step 1: Get booking ${bookingId} details`);
            const fetched=await bookingApi.getBooking(bookingId);

            log.info(`Step 2: verify the booking details`)
            expect(fetched.firstname).toBe(updatedpayload.firstname);
            expect(fetched.lastname).toBe(updatedpayload.lastname);
            expect(fetched.totalprice).toBe(updatedpayload.totalprice);
           
            await testInfo.attach('get-booking', {
                body: JSON.stringify(fetched, null, 2),
                contentType: 'application/json',
            });

            log.info(`Step 3: GET booking ${bookingId} request is SUCCESS`);
        })
    })


    test('Delete Booking(token comes from fixtures) and Verify that the booking has been deleted',async ({bookingApi,bookerToken},testInfo)=>{
        
        await test.step(`DELETE /booking/${bookingId} using fixture token`,async ()=>{
            log.info(`Step 1: DELETE booking ${bookingId} using fixture token`);
            const status=await bookingApi.deleteBooking(bookingId,bookerToken);

            log.info(`Step 2: verify the delete booking status code ${status}`)
            expect(status).toBe(201);
           
            await testInfo.attach('delete-booking', {
                body: JSON.stringify(status, null, 2),
                contentType: 'application/json',
            });
        })

        await test.step(`GET /booking/${bookingId} should now return 404`,async ()=>{
            log.info(`Step 1: Confirm booking ${bookingId} has been deleted(expect 404)`);
            const getBooking=await bookingApi.getBookingResponse(bookingId);
            expect(getBooking.status()).toBe(404)
            log.info(`Step 2: booking ${bookingId} returns 404 as expected`);
        })
    })
})

/*
We could execute this via terminal:
npm run test:api -- src/tests/apiTests/03_restfulbooker_fixture_e2e_api/booking-crud-e2e-fixtures.spec.ts
Steps
1.it calls "test:api": "cross-env BASE_URL= TTA_ENV=api playwright test", in package.json
As part of this script we are setting BASE_URL=blank and TTA_ENV to api
2.As TTA_ENV is set to api, executes resolveBaseURL() - in playwright.config.ts
function resolveBaseURL(): string {
    if (process.env.BASE_URL) return process.env.BASE_URL;//false(as BASE_URL is empty)
    const env = (process.env.TTA_ENV || 'qa').toLowerCase();//env=api(as process.env.TTA_ENV is set to api)
    switch (env) {
      case 'api':
        return process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com';

*/