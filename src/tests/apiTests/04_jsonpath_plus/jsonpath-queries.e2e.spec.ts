import { JSONPath } from 'jsonpath-plus'
import { test, expect } from '@fixtures/booker-fixture'
import { createLogger } from '@src/utils/logger'
import { buildBooking } from '@src/testdata/api-booking-data'
import { BookingApi } from '@src/api/BookingApi';

export const getValue = (path: string, json: any) => JSONPath({ path, json })[0];

test.describe.serial('@e2e @P0 Level 3 - JSONPath queries on create booking reponse', () => {
    let bookingId: number;

    test('create a booking and read the response fields with JSONPath', async ({ bookingApi }) => {
        const payload = buildBooking({ firstname: 'JSON', lastname: 'Path', additionalneeds: 'dinner' })

        // The whole POST /booking response: { bookingid, booking: { ... } }
        const responseBody = await bookingApi.createBooking(payload);

        //Top-level value -> the new id.
        //const id = JSONPath({ path: '$.bookingid', json: body })[0];
        bookingId = getValue('$.bookingid', responseBody);
        console.log(bookingId)
        expect(bookingId).toBeGreaterThan(0);

        //Single nested value -> $.booking.firstname  (array result, take [0]).
        //const firstname = JSONPath({ path: '$.booking.firstname', json: body })[0];
        const firstname = getValue('$.booking.firstname', responseBody);
        expect(firstname).toBe(payload.firstname)

        //Deep nested value -> reach into bookingdates without manual chaining.
        const checkin = JSONPath({ path: '$.booking.bookingdates.checkin', json: responseBody })[0];
        expect(checkin).toBe(payload.bookingdates.checkin)
    })

    test('wildcard + recursive - descent queries',async({bookingApi})=>{
        
    })



})