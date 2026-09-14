import { test, expect } from '@playwright/test'
//https://restful-booker.herokuapp.com/ping
test("Validate restful booker ping request", async ({ request }) => {
    const responseData = await request.get("/ping")
    console.log(responseData)
    expect(responseData.status()).toBe(201)
})