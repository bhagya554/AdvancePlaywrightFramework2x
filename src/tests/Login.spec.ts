import { test, expect } from '@playwright/test'
import { LoginPage } from '@src/pages/LoginPage'
import { createLogger } from '@src/utils/logger'

const log = createLogger('Login.spec')
test.describe('TTACart - Login', () => {
    let loginPage: LoginPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);

        await test.step('Open the TTACart Login Page', async () => {
            log.info('Opening TTACart Login Page')
            await loginPage.open()
        })
    })

    test('Login to TTACart with valid credentials @p0', async () => {
        await test.step('Login as standard_user', async () => {
            log.info('Logging in as standard_user')
            await loginPage.loginAs('standard_user', 'tta_secret')
        })

        await test.step('Verify login form is no longer shown', async () => {
            log.info('Asserting login form is hidden after login')
            const loginButton=loginPage.getLoginButtonLocator();
            await expect(loginButton).toBeHidden();
        })
    })
})