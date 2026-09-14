/**
 * Data-driven login — one test per row in src/testdata/logintestdata.json.
 *
 * Rows marked "success" must land on the inventory page; rows marked "locked"
 * must stay on the login screen and surface the error banner.
 *
 * Adding a user to the JSON adds a test — no change needed here.
 */

import { test } from '@fixtures/test-base';
import { createLogger } from '@utils/logger';
import { visualStep } from '@utils/visualStep';
import loginTestData from '@testdata/logintestdata.json';

type LoginCase = {
    username: string;
    password: string;
    outcome: 'success' | 'locked';
    /** Substring the error banner must contain. Only set on "locked" rows. */
    expectedError?: string;
    note: string;
};

const log = createLogger('login-data-driven');
const cases = loginTestData as LoginCase[];

test.describe('@P1 @Regression @Login Data-driven login', () => {
    for (const user of cases) {
        test(`logs in as ${user.username} (expects ${user.outcome})`, async ({
            page,
            loginPage,
            inventoryPage,
        }) => {
            await visualStep(page, 'Open the login page', async () => {
                await loginPage.open();
            });

            await visualStep(page, `Submit credentials for ${user.username}`, async () => {
                log.info(`${user.username} — ${user.note}`);
                // loginAs() polls until either /inventory is reached or the error
                // banner appears, so both branches below are settled by now.
                await loginPage.loginAs(user.username, user.password);
            });

            if (user.outcome === 'success') {
                await visualStep(page, 'Inventory page is shown', async () => {
                    // Login already navigated here — assert, don't re-open.
                    await inventoryPage.assertLoaded();
                });
            } else {
                await visualStep(page, 'Error banner is shown', async () => {
                    if (user.expectedError) {
                        await loginPage.expectErrorContains(user.expectedError);
                    } else {
                        await loginPage.expectErrorVisible();
                    }
                });
            }
        });
    }
});
