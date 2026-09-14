import { en } from '@faker-js/faker'
import { test, expect } from '@playwright/test'
import { logger } from '@utils/logger'

interface BookingDates {
    checkin: string,
    checkout: string
}

interface BookingPayload {
    firstname: string,
    lastname: string,
    totalprice: number,
    depositpaid: boolean,
    bookingdates: BookingDates,
    additionalneeds: string
}

interface CreateBookingResponse {
    bookingid: number,
    booking: BookingPayload
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

test.describe.serial("Restful Booker CRUD API", () => {

    //const baseURL = process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com';
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

    const updatebookingPayload: BookingPayload = {
        firstname: 'Saara',
        lastname: 'Jeswal',
        totalprice: 9000,
        depositpaid: false,
        bookingdates: {
            checkin: '2018-01-01',
            checkout: '2019-01-01'
        },
        additionalneeds: 'dinner'
    };
    const tokenPayload: TokenPayload = {
        username: 'admin',
        password: 'password123'
    }

    const bookingFlowState: BookingFlowState = {};

    test('TC#01 @p0 - Create Token', async ({ request }) => {
        await test.step('Create Token', async () => {
            const tokenResponse = await request.post(`/auth`, {
                headers,
                data: tokenPayload
            })

            expect(tokenResponse.status()).toBe(200);
            const data = await tokenResponse.json() as TokenResponse;
            expect(data.token).toBeTruthy();

            bookingFlowState.token = data.token;
            logger.info("Created Auth Token for CRUD flow: " + bookingFlowState.token);

        })
    })

    test('TC#02 @p0 - Create Booking', async ({ request }) => {
        await test.step('Create Booking', async () => {
            const responseData = await request.post(`/booking`, {
                headers,
                data: bookingPayload
            });
            expect(responseData.status()).toBe(200)
            const createBookingResponse = await responseData.json() as CreateBookingResponse;
            expect(createBookingResponse.bookingid).toBeTruthy()
            expect(createBookingResponse.booking.firstname).toBe(bookingPayload.firstname);
            expect(createBookingResponse.booking.lastname).toBe(bookingPayload.lastname);

            bookingFlowState.bookingId = createBookingResponse.bookingid;
            logger.info("Created Booking for CRUD flow: " + createBookingResponse.booking.firstname + " " + createBookingResponse.booking.lastname);
            logger.info("Created Booking for CRUD flow: " + bookingFlowState.bookingId);
        })
    })

    test('TC#03 @p0 - Update Booking', async ({ request }) => {
        await test.step('Update Booking', async () => {
            const token = bookingFlowState.token;
            const bookingId = bookingFlowState.bookingId;
            if (!token || !bookingId) {
                throw new Error('Create token and create booking tests must pass before update booking.');
            }
            const responseData = await request.put(`/booking/${bookingId}`, {
                headers: {
                    ...headers,
                    Cookie: `token=${token}`
                },
                data: updatebookingPayload
            });
            expect(responseData.status()).toBe(200)
            const updateBookingResponse = await responseData.json() as BookingPayload;

            expect(updateBookingResponse.firstname).toBe(updatebookingPayload.firstname);
            expect(updateBookingResponse.lastname).toBe(updatebookingPayload.lastname);

            logger.info("Updated Booking for CRUD flow: " + updateBookingResponse.firstname + " " + updateBookingResponse.lastname);
        })
    })

    test('TC#04 @p0 - Get Booking', async ({ request }) => {

    })

    test('TC#05 @p0 - Delete Booking', async ({ request }) => {

    })






})


