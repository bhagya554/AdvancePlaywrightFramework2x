// Inbuilt fixtures are already available in this case. 

/**
 * test-base — the project's custom Playwright `test`, pre-wired with a fixture
 * for every TTACart Page Object.
 *
 * Instead of `new LoginPage(page)` in each spec, ask for the page you need and
 * it's handed over already constructed against the test's `page`:
 *
 *   import { test, expect } from '@fixtures/test-base';
 *
 *   test('add to cart', async ({ inventoryPage, cartPage }) => {
 *       await inventoryPage.open();
 *       await inventoryPage.addToCart('tta-bike-light');
 *       await cartPage.open();
 *       expect(await cartPage.rowCount()).toBe(1);
 *   });
 *
 * Plain page-object fixtures hand over constructed objects without navigating.
 * State fixtures (`invalidLogin`, `validLogin`, `loginWithInventory`, and
 * `loginWithSelectedItem`) perform reusable setup only when a test requests one.
 */

import { test as base, expect } from '@playwright/test';
import { credentials } from '@config/credentials';
import { LoginPage } from '@pages/LoginPage';
import { InventoryPage } from '@pages/InventoryPage';
import { ItemDetailPage } from '@pages/ItemDetailPage';
import { CartPage } from '@pages/CartPage';
import { CheckoutStepOnePage } from '@pages/CheckoutStepOnePage';
import { CheckoutStepTwoPage } from '@pages/CheckoutStepTwoPage';
import { CheckoutCompletePage } from '@pages/CheckoutCompletePage';

/** What `invalidLogin` hands over — the page still showing the error banner. */
export type InvalidLoginState = {
    loginPage: LoginPage;
    username: string;
};

/** What `loginWithSelectedItem` hands over — inventory plus the item it added. */
export type SelectedItemState = {
    inventoryPage: InventoryPage;
    itemId: string;
};

/** Credentials used by `invalidLogin` — no such account on TTACart. */
export const INVALID_CREDENTIALS = {
    username: 'invalid_user',
    password: 'wrong_password',
};

/** Item `loginWithSelectedItem` puts in the cart. */
export const DEFAULT_ITEM_ID = 'test-allthethings-tshirt-red';

//use is the callback supplied by playwright. It provides fixture value to the test
export type TestFixture = {
    // Page Objects
    loginPage: LoginPage;
    inventoryPage: InventoryPage;
    itemDetailPage: ItemDetailPage;
    cartPage: CartPage;
    checkoutStepOnePage: CheckoutStepOnePage;
    checkoutStepTwoPage: CheckoutStepTwoPage;
    checkoutCompletePage: CheckoutCompletePage;

    // State fixtures. Each layers on the one below it — loginWithSelectedItem
    // depends on loginWithInventory, which depends on validLogin — so logging
    // in happens once per test no matter how deep the chain goes.
    validLogin: LoginPage;
    invalidLogin: InvalidLoginState;
    loginWithInventory: InventoryPage;
    loginWithSelectedItem: SelectedItemState;
};

export const test = base.extend<TestFixture>({

    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    inventoryPage: async ({ page }, use) => {
        await use(new InventoryPage(page));
    },
    itemDetailPage: async ({ page }, use) => {
        await use(new ItemDetailPage(page));
    },
    cartPage: async ({ page }, use) => {
        await use(new CartPage(page));
    },
    checkoutStepOnePage: async ({ page }, use) => {
        await use(new CheckoutStepOnePage(page));
    },
    checkoutStepTwoPage: async ({ page }, use) => {
        await use(new CheckoutStepTwoPage(page));
    },
    checkoutCompletePage: async ({ page }, use) => {
        await use(new CheckoutCompletePage(page));
    },

    // ---------- state fixtures ----------
    // Playwright builds a fixture only when a test asks for it by name, so
    // these cost nothing for tests that don't request them.

    /**
     * Successful authentication. Base of the chain — the three fixtures below
     * build on it rather than logging in again.
     */
    validLogin: async ({ loginPage }, use) => {
        await loginPage.open();
        await loginPage.loginAs(credentials.standardUser, credentials.password);
        // loginAs() settles on EITHER inventory or the error banner, so confirm
        // which one happened before handing over. Without this a failed login
        // is discovered later, at some unrelated step.
        await loginPage.waitForLoginButtonHidden();
        await use(loginPage);
    },

    /**
     * Independent negative state — the unknown account stays on the login
     * screen with the error banner shown. Not part of the validLogin chain.
     */
    invalidLogin: async ({ loginPage }, use) => {
        await loginPage.open();
        await loginPage.loginAs(INVALID_CREDENTIALS.username, INVALID_CREDENTIALS.password);
        // Same reason as validLogin — assert the login actually failed, so the
        // fixture's name is guaranteed true for every test that requests it.
        await loginPage.expectErrorVisible();
        await use({ loginPage, username: INVALID_CREDENTIALS.username });
    },

    /**
     * Depends on validLogin and guarantees inventory is loaded. Login already
     * lands here, so this asserts rather than navigating again.
     */
    loginWithInventory: async ({ validLogin, inventoryPage }, use) => {
        await inventoryPage.assertLoaded();
        await use(inventoryPage);
    },

    /**
     * Depends on inventory and guarantees one item is in the cart. Entry point
     * for cart and checkout tests.
     */
    loginWithSelectedItem: async ({ loginWithInventory }, use) => {
        await loginWithInventory.addToCart(DEFAULT_ITEM_ID);
        await use({ inventoryPage: loginWithInventory, itemId: DEFAULT_ITEM_ID });
    },
});

export { expect };