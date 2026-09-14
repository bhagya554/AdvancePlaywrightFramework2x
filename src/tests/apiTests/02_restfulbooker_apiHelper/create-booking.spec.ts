import { test, expect } from '@playwright/test'
import { createLogger } from '@src/utils/logger'
import { ApiHelper } from '@src/utils/APIHelper'

const log = createLogger('Create Booking - API Helper')

interface BookingDates {
    checkin: string;
    checkout: string;
}

interface BookingPayload {
    firstname: string;
    lastname: string;
    totalprice: number;
    depositpaid: boolean;
    bookingdates: BookingDates;
    additionalneeds: string;
}

interface CreateBookingResponse {
    bookingid: number;
    booking: BookingPayload;
}



test.describe('@P0 @regression Level 2 (ApiHelper) - POST create booking', () => {
    test('POST /booking creates booking and echoes it back', async ({ request }, testInfo) => {
        const api = new ApiHelper(request);

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        const bookingPayload: BookingPayload = {
            firstname: 'Bhagya',
            lastname: 'Kudupdi',
            totalprice: 6000,
            depositpaid: true,
            bookingdates: {
                checkin: '2018-01-01',
                checkout: '2019-01-01'
            },
            additionalneeds: 'lunch'
        };

        let createBookingResponse: CreateBookingResponse;

        //Step 1 : Send the create booking request
        await test.step('POST /booking with a new booking payload', async () => {
            log.info(`Step 1: POST /booking for ${bookingPayload.firstname} ${bookingPayload.lastname} (price ${bookingPayload.totalprice})`);
            const response = await api.post('/booking', bookingPayload, { headers })

            log.info(`Step 2: server responded with status ${response.status()}`);
            expect(api.isSuccess(response)).toBe(true);

            log.info(`Step 3: Parsing the create booking response - ${await response.text()}`);
            createBookingResponse = await api.parseJsonResponse<CreateBookingResponse>(response);
            const { bookingid } = await api.parseJsonResponse<{ bookingid: number }>(response);
            console.log("Booking parsed a booking id: " + bookingid)
            // Attach the raw response so it shows up in the report.
            log.info(`Step 4: Attach the raw response to show in the report`);
            testInfo.attach('Create-Booking-Response-APIHelper', {
                body: JSON.stringify(createBookingResponse, null, 2),
                contentType: 'application/json'
            })
        })
        // Step 2 — verify the server echoed the booking back
        await test.step('Verify the created booking is echoed back', async () => {
            log.info(`Step 5: verifying booking id ${createBookingResponse.bookingid} echoes the payload`);
            expect(createBookingResponse.bookingid).toBeGreaterThan(0);
            expect(createBookingResponse.booking.firstname).toBe(bookingPayload.firstname);
            expect(createBookingResponse.booking.lastname).toBe(bookingPayload.lastname);
            expect(createBookingResponse.booking.additionalneeds).toBe(bookingPayload.additionalneeds);
            expect(createBookingResponse.booking.bookingdates.checkin).toBe(bookingPayload.bookingdates.checkin);
            log.info(`Step 6: booking ${createBookingResponse.bookingid} verified OK`);
        })
    })
})
