import { test as base, expect } from '@playwright/test'
import { BookingApi } from '@src/api/BookingApi'

export type BookerFixtures = {
    bookingApi: BookingApi;
    bookerToken: string
}

export const test = base.extend<BookerFixtures>({
    bookingApi: async ({ request, baseURL }, use) => {
        await use(new BookingApi(request, baseURL))
    },
    bookerToken: async ({ bookingApi }, use) => {
        const token = await bookingApi.getAuthToken();
        await use(token)
    }
})

export { expect }