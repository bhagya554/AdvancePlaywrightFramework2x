import {expect, Locator, Page } from '@playwright/test'
import { BasePage } from './BasePage'

/**
 * TTACart login screen.
 *
 *   const login = new LoginPage(page);
 *   await login.open();
 *   await login.loginAs('standard_user', 'tta_secret');
 */


export class LoginPage extends BasePage {
    static readonly PATH = '/playwright/ttacart/index.html';

    private readonly usernameInput: Locator;
    private readonly passwordInput: Locator;
    private readonly loginButton: Locator;
    private readonly errorBox: Locator;
    private readonly loginCredentialsHint: Locator;


    constructor(page: Page) {
        super(page, "LoginPage")
        this.usernameInput = page.locator("[data-test='username']")
        this.passwordInput = page.locator("[data-test='password']")
        this.loginButton = page.locator('[data-test="login-button"]');
        this.errorBox = page.locator('[data-test="error"]');
        this.loginCredentialsHint = page.locator('[data-test="login-credentials"]');
    }

    async open(): Promise<void> {
        this.log.info("Open Login Page")
        await this.goto(LoginPage.PATH)
    }

    async loginAs(username: string, password: string) {
        this.log.info(`Login As: ${username}`)
        await this.el.fill(this.usernameInput, username);
        await this.el.fill(this.passwordInput, password);
        await this.el.click(this.loginButton);
        await expect.poll(async () => (
            this.page.url().includes('/inventory') || await this.errorBox.isVisible()
        )).toBe(true);

    }

    //below method not required - i have written
    //waitForLoginButtonHidden() can handle this 
    getLoginButtonLocator(): Locator {
        this.log.info('Getting Login button Locator')
        return this.el.getLocator(this.loginButton)
    }

    async waitForLoginButtonHidden(): Promise<void> {
        await this.el.waitForHidden(this.loginButton);
    }

    async expectErrorVisible(): Promise<void> {
        this.log.info('Asserting the login error banner is shown')
        await expect(this.errorBox).toBeVisible();
    }

    async expectErrorContains(text: string): Promise<void> {
        this.log.info(`Asserting the login error banner contains "${text}"`)
        await expect(this.errorBox).toBeVisible();
        await expect(this.errorBox).toContainText(text);
    }

    async errorText(): Promise<string> {
        return this.el.getText(this.errorBox);
    }


}