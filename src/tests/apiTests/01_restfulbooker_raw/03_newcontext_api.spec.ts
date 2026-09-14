import { test, expect, request } from '@playwright/test'
test("New Context for isolated requests", async () => {
    const token = 'demo-token'
    const ctx = await request.newContext({
        baseURL: 'https://gorest.in',
        extraHTTPHeaders: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        timeout: 15_000
    })
//create user
    const responseData = await ctx.post('/public/v2/users', {
        data: {
            "name": "Rishi Kumar",
            "email": "rk@test.com",
            "gender": "male",
            "status": "active"
        }
    })
    expect(responseData.status()).toBe(201)
    console.log(await responseData.json())

//get user
    const ping = await ctx.get('/public/v2/users/1001?page=1&per_page=10');
    expect(ping.status()).toBe(200);
    console.log(await ping.json())

    await ctx.dispose();

})