import { test, expect } from '@playwright/test'
import { createLogger } from '@src/utils/logger'
import { ApiHelper } from '@src/utils/APIHelper'

const log = createLogger('Update Booking - API Helper')

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

interface TokenPayload {
    username: string,
    password: string
}

interface TokenResponse {
    token: string
}

interface BookingFlowState {
    token?: string,
    bookingId?: number
}



test.describe('@P0 @regression Level 2 (ApiHelper) - PUT update booking', () => {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }

    const tokenPayload: TokenPayload = {
        username: 'admin',
        password: 'password123'
    }
    const createbookingPayload: BookingPayload = {
        firstname: 'Sara',
        lastname: 'Agarwal',
        totalprice: 6000,
        depositpaid: true,
        bookingdates: {
            checkin: '2018-01-01',
            checkout: '2019-01-01'
        },
        additionalneeds: 'lunch'
    };

    const updatebookingPayload: BookingPayload = {
        firstname: 'Tina',
        lastname: 'Jeswal',
        totalprice: 9000,
        depositpaid: false,
        bookingdates: {
            checkin: '2018-01-01',
            checkout: '2019-01-01'
        },
        additionalneeds: 'dinner'
    };

    const bookingFlowState: BookingFlowState = {};
    test('PUT /booking/{id} replaces the booking with a cookie token', async ({ request }, testInfo) => {
        const api = new ApiHelper(request);

        await test.step('Step 1: Create Token and retrive the token', async () => {
            const authResponse = await api.post('/auth', tokenPayload, { headers });
            const { token } = await api.parseJsonResponse<{ token: string }>(authResponse);
            expect(token).toBeTruthy();
            bookingFlowState.token = token;
            log.info(`Step 1: Token has been generated: ${bookingFlowState.token}`)
        });

        await test.step(`Step 2: Create Booking with ${createbookingPayload.firstname} ${createbookingPayload.lastname} and retrive the Booking Id`, async () => {
            const response = await api.post('/booking', createbookingPayload, { headers });
            const createBookingResponse = await api.parseJsonResponse<CreateBookingResponse>(response);
            expect(createBookingResponse.bookingid).toBeTruthy();
            bookingFlowState.bookingId = createBookingResponse.bookingid;
            log.info(`Step 2.1: Booking created with id ${createBookingResponse.bookingid}`)
            log.info(`Step 2.2: Booking created with firstname ${createBookingResponse.booking.firstname}`)
            expect(createBookingResponse.booking.firstname).toBe(createbookingPayload.firstname);
            log.info(`Step 2.3: Created the booking id ${bookingFlowState.bookingId} verified OK`);
        });

        let updatedBookingResponse: BookingPayload;

        await test.step(`Step 3: Update Booking with ${updatebookingPayload.firstname} ${updatebookingPayload.lastname}`, async () => {
            const token = bookingFlowState.token;
            const bookingId = bookingFlowState.bookingId;
            log.info(`Step 3.1: Update /booking/{bookingid} for ${updatebookingPayload.firstname} ${updatebookingPayload.lastname}`)
            const response = await api.put(`/booking/${bookingId}`, updatebookingPayload,
                {
                    headers:
                    {
                        ...headers,
                        Cookie: `token=${token}`
                    }
                });

            log.info(`Step 3.2: server responded with status ${response.status()}`);
            expect(api.isSuccess(response)).toBe(true);

            log.info(`Step 3.3: Parsing the update booking response - ${await response.text()}`);
            updatedBookingResponse = await api.parseJsonResponse<BookingPayload>(response);


            log.info(`Step 3.4: Attach the raw response to show in the report`);
            testInfo.attach('Update-Booking-Response-APIHelper', {
                body: JSON.stringify(updatedBookingResponse, null, 2),
                contentType: 'application/json'
            })
        });

        await test.step('Step 4: Verify the updated booking is echoed back', async () => {
            log.info(`Step 4.1: verifying booking id ${bookingFlowState.bookingId} is updated with ${updatedBookingResponse.firstname} echoes the payload`);
            expect(updatedBookingResponse.firstname).toBe(updatebookingPayload.firstname);
            expect(updatedBookingResponse.lastname).toBe(updatebookingPayload.lastname)
            expect(updatedBookingResponse.additionalneeds).toBe(updatebookingPayload.additionalneeds);
            expect(updatedBookingResponse.bookingdates.checkin).toBe(updatebookingPayload.bookingdates.checkin);
            log.info(`Step 4.2: Updated the booking id ${bookingFlowState.bookingId} verified OK`);
        });

    });

});