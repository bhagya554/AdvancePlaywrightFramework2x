import { test, expect } from '@playwright/test'
import { createLogger } from '@src/utils/logger'
import { ApiHelper } from '@src/utils/APIHelper'

const log = createLogger('Create Booking - API Helper Retry')

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



test.describe('@P0 @regression Level 2 (ApiHelper) - POST create booking with retry', () => {
    test('POST /booking via callApiWithRetry creates booking and echoes it back', async ({ request }, testInfo) => {
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

        //Step 1 : Send the create booking request, retrying until the server returns 2xx
        await test.step('POST /booking with retry until 2xx', async () => {
            log.info(`Step 1: POST /booking for ${bookingPayload.firstname} ${bookingPayload.lastname} with retry`);
            // Note: POST is not idempotent — a retry after a failed-but-processed attempt could create a duplicate booking.
            const response = await api.callApiWithRetry(
                { url: '/booking', method: 'POST', headers, data: bookingPayload },
                {
                    condition: (res) => {
                        log.info(`Step 1.1: attempt returned status ${res.status()}`);
                        return api.isSuccess(res);
                    },
                    pollingInterval: 2000,
                    retryCount: 3
                }
            );

            log.info(`Step 2: final response status ${response.status()}`);
            expect(api.isSuccess(response)).toBe(true);

            log.info(`Step 3: Parsing the create booking response - ${await response.text()}`);
            createBookingResponse = await api.parseJsonResponse<CreateBookingResponse>(response);

            // Attach the raw response so it shows up in the report.
            log.info(`Step 4: Attach the raw response to show in the report`);
            testInfo.attach('Create-Booking-Retry-Response-APIHelper', {
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
