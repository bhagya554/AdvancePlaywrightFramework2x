/**
 * Fixture-driven suite — every test here starts from a state fixture instead
 * of repeating its own login/navigation boilerplate.
 *
 *   validLogin            -> logged in, past the login screen
 *   invalidLogin          -> still on login, error banner shown
 *   loginWithInventory    -> logged in, on a verified inventory page
 *   loginWithSelectedItem -> logged in, inventory, one item already in the cart
 *
 * Compare the checkout test at the bottom with e2e-checkout.spec.ts: the first
 * three steps are gone, absorbed by the fixture.
 */

import { test, expect, DEFAULT_ITEM_ID } from '@fixtures/test-base';
import { DataGenerator } from '@utils/DataGenerator';
import { createLogger } from '@utils/logger';
import { visualStep } from '@utils/visualStep';

const log = createLogger('e2e-checkout-MoreFixtureUsage');

test.describe('@P1 @Regression @Fixtures State fixture usage', () => {

    test('validLogin lands past the login screen', async ({ page, validLogin, inventoryPage }) => {
        await visualStep(page, 'Login form is gone', async () => {
            log.info('Fixture logged in via validLogin');
            // validLogin yields the LoginPage itself — no separate fixture needed.
            await validLogin.waitForLoginButtonHidden();
        });

        await visualStep(page, 'Inventory page is reachable', async () => {
            await inventoryPage.open();
        });
    });

    test('invalidLogin stays on the login screen with an error', async ({ page, invalidLogin }) => {
        await visualStep(page, 'Error banner is shown', async () => {
            log.info(`Fixture attempted login as ${invalidLogin.username}`);
            await invalidLogin.loginPage.expectErrorContains('Username and password do not match');
        });

        await visualStep(page, 'Login button is still on screen', async () => {
            // Never reached the inventory page, so the form is still live.
            await expect(invalidLogin.loginPage.getLoginButtonLocator()).toBeVisible();
        });
    });

    test('loginWithInventory exposes the full product catalogue', async ({ page, loginWithInventory }) => {
        await visualStep(page, 'Read the product names', async () => {
            // The fixture yields the InventoryPage, already asserted as loaded.
            const names = await loginWithInventory.productNames();
            log.info(`Inventory shows ${names.length} products: ${names.join(', ')}`);

            expect(names.length).toBeGreaterThanOrEqual(6);
            expect(names).toContain('TTA Bike Light');
        });
    });

    test('loginWithSelectedItem starts with exactly one item in the cart', async ({ page, loginWithSelectedItem, cartPage }) => {
        await visualStep(page, 'Open the cart', async () => {
            log.info(`Fixture pre-selected "${loginWithSelectedItem.itemId}"`);
            await cartPage.open();
        });

        await visualStep(page, 'Cart holds the fixture item only', async () => {
            expect(await cartPage.rowCount()).toBe(1);
            expect(loginWithSelectedItem.itemId).toBe(DEFAULT_ITEM_ID);
        });
    });

    test('loginWithSelectedItem checks out without repeating setup', async ({
        page,
        loginWithSelectedItem,
        cartPage,
        checkoutStepOnePage,
        checkoutStepTwoPage,
        checkoutCompletePage,
    }) => {
        const customer = DataGenerator.checkoutCustomer();

        // Login, inventory and add-to-cart already happened in the fixture.
        await visualStep(page, 'Open the cart', async () => {
            log.info(`Checking out "${loginWithSelectedItem.itemId}"`);
            await cartPage.open();
            expect(await cartPage.rowCount()).toBe(1);
        });

        await visualStep(page, 'Fill guest details (checkout step one)', async () => {
            await cartPage.checkout();
            await checkoutStepOnePage.assertLoaded();
            await checkoutStepOnePage.fillGuest(customer);
            await checkoutStepOnePage.continue();
        });

        await visualStep(page, 'Overview totals add up', async () => {
            await checkoutStepTwoPage.assertLoaded();
            expect(await checkoutStepTwoPage.rowCount()).toBe(1);

            const itemTotal = await checkoutStepTwoPage.itemTotal();
            const tax = await checkoutStepTwoPage.tax();
            const total = await checkoutStepTwoPage.total();
            log.info(`itemTotal=${itemTotal} tax=${tax} total=${total}`);
            expect(total).toBeCloseTo(itemTotal + tax, 2);
        });

        await visualStep(page, 'Finish the order', async () => {
            await checkoutStepTwoPage.finish();
            await checkoutCompletePage.assertOrderComplete();
        });
    });
});
