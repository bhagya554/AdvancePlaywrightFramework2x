/**
 * Data-driven end-to-end checkout — one test per row in checkouttestdata.json.
 *
 * Each row varies the user, the items added, and whether checkout step one
 * needs a second submit (the problem_user quirk). Customer details are
 * generated per row rather than pinned in data — the names are incidental.
 *
 * Adding a row adds a test; no change needed here.
 */

import { test, expect } from '@fixtures/test-base';
import { DataGenerator } from '@utils/DataGenerator';
import { createLogger } from '@utils/logger';
import { visualStep } from '@utils/visualStep';
import checkoutTestData from '@testdata/checkouttestdata.json';

type CheckoutCase = {
    caseId: string;
    username: string;
    password: string;
    items: string[];
    /** problem_user wipes firstName on the first submit — refill and resubmit. */
    submitStepOneTwice: boolean;
    note: string;
};

const log = createLogger('e2e-checkout-data-driven');
const cases = checkoutTestData as CheckoutCase[];

test.describe('@P0 @Regression E2E @Checkout Data-driven checkout', () => {
    for (const tc of cases) {
        test(`${tc.caseId} — checkout as ${tc.username} with ${tc.items.length} item(s)`, async ({
            page,
            loginPage,
            inventoryPage,
            cartPage,
            checkoutStepOnePage,
            checkoutStepTwoPage,
            checkoutCompletePage,
        }) => {
            const customer = DataGenerator.checkoutCustomer();

            await visualStep(page, `Log in as ${tc.username}`, async () => {
                log.info(`${tc.caseId}: ${tc.note}`);
                await loginPage.open();
                await loginPage.loginAs(tc.username, tc.password);
            });

            await visualStep(page, 'Go to the inventory page', async () => {
                await inventoryPage.open();
            });

            await visualStep(page, `Add ${tc.items.length} item(s) to the cart`, async () => {
                for (const id of tc.items) {
                    log.info(`Adding "${id}" to the cart`);
                    await inventoryPage.addToCart(id);
                }
            });

            await visualStep(page, 'Open the cart', async () => {
                await cartPage.open();
                expect(await cartPage.rowCount()).toBe(tc.items.length);
            });

            await visualStep(page, 'Fill guest details (checkout step one)', async () => {
                log.info(`Filling guest details for ${customer.firstName} ${customer.lastName}`);
                await cartPage.checkout();
                await checkoutStepOnePage.assertLoaded();
                await checkoutStepOnePage.fillGuest(customer);
                await checkoutStepOnePage.continue();

                if (tc.submitStepOneTwice) {
                    log.info('Row expects the first submit to be discarded — refilling');
                    await checkoutStepOnePage.fillGuest(customer);
                    await checkoutStepOnePage.continue();
                }
            });

            await visualStep(page, 'Finish the order (checkout step two)', async () => {
                await checkoutStepTwoPage.assertLoaded();
                expect(await checkoutStepTwoPage.rowCount()).toBe(tc.items.length);
                await checkoutStepTwoPage.finish();
            });

            await visualStep(page, 'Order is complete', async () => {
                await checkoutCompletePage.assertOrderComplete();
            });
        });
    }
});
