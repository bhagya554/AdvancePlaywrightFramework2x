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

        //1.Top-level value -> the new id.
        //const id = JSONPath({ path: '$.bookingid', json: body })[0];
        bookingId = getValue('$.bookingid', responseBody);
        console.log(bookingId)
        expect(bookingId).toBeGreaterThan(0);

        //2.Single nested value -> $.booking.firstname  (array result, take [0]).
        //const firstname = JSONPath({ path: '$.booking.firstname', json: body })[0];
        const firstname = getValue('$.booking.firstname', responseBody);
        expect(firstname).toBe(payload.firstname)

        //3.Deep nested value -> reach into bookingdates without manual chaining.
        const checkin = JSONPath({ path: '$.booking.bookingdates.checkin', json: responseBody })[0];
        expect(checkin).toBe(payload.bookingdates.checkin)
    })

    test('wildcard + recursive - descent queries', async ({ bookingApi }) => {
        const payload = buildBooking({ firstname: 'wild', lastname: 'card', totalprice: 345 });

        const responseBody = await bookingApi.createBooking(payload);

        // 4. Wildcard -> every direct child VALUE of booking (firstname, lastname,
        //    totalprice, depositpaid, bookingdates, additionalneeds).

        const allCreateBookingValues = JSONPath({ path: '$.booking.*', json: responseBody });
        expect(allCreateBookingValues).toContain(payload.firstname)
        expect(allCreateBookingValues).toContain(payload.lastname)
        expect(allCreateBookingValues).toContain(payload.totalprice)

        // 5) Recursive descent -> find totalprice ANYWHERE in the payload, no
        //    matter how deeply nested. One expression, zero loops.
        const price = JSONPath({ path: '$..totalprice', json: responseBody })
        expect(price).toEqual([345])

        // 6) Recursive descent for a deep key -> grab checkin/checkout dates.
        const bookingdate = JSONPath({ path: '$..bookingdates', json: responseBody })
        expect(bookingdate).toHaveProperty('checkin')
        expect(bookingdate).toHaveProperty('checkout')
    })


    test('array queries: index,slice and filter on Get /booking', async ({ bookingApi }) => {
        // GET /booking -> an ARRAY like [{ bookingid: 1 }, { bookingid: 2 }, ...]
        const list = await bookingApi.getAllBookings();
        expect(Array.isArray(list)).toBe(true)

        // 7) Index -> first element's id  ($[0].bookingid). is of type number
        const firstid = JSONPath({ path: '$[0].bookingid', json: list })[0]
        expect(typeof firstid).toBe('number')

        // 8) Slice -> last element's id  ($[-1:].bookingid)  - 
        // Ex: $.store.book[-1:]    → last book (negative index via slice)
        /*
        -1 means "start from the last element"
        : means "up to the end"
        */
        const lastid = JSONPath({ path: '$[-1:].bookingid', json: list })[0]
        expect(typeof lastid).toBe('number')

        // 9) Wildcard across the array -> EVERY bookingid in one shot
        /*
        Step 1: Example array
        const allIds = [101, 102, 103];

        Step 2: every()
        allIds.every((n)=>Number.isInteger(n))
        every() checks each element and returns:
        true if all elements satisfy the condition
        false if any one element fails

        Step 3: expect(...).toBe(true)
        expect(true).toBe(true);
        */

        const allIds:number[]=JSONPath({path:'$[*].bookingid',json:list})
        expect(allIds.length).toHaveLength(list.length)
        expect(allIds.every((n)=>Number.isInteger(n))).toBe(true)

        // 10) Filter -> only objects whose bookingid is > 0  ([?(@.bookingid > 0)]).
        //     `@` is the current item being tested by the filter.
        const positives:{bookingid:number}[]=JSONPath({path:'$[?(@.bookingid>0)]',json:list})
        expect(positives).toHaveLength(list.length);
        expect(positives.every((n)=>n.bookingid>0)).toBe(true);
    })


    test('cleanup the booking created above',async({bookingApi,bookerToken})=>{
        const status=await bookingApi.deleteBooking(bookingId,bookerToken);
        expect(status).toBe(201)
    })


})