import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * TTACart "Checkout: Overview" page — step 2 of checkout.
 *
 * Shows the line items being purchased plus the payment / shipping summary and
 * the price breakdown (item total, tax, total). `finish()` places the order and
 * lands on CheckoutCompletePage; `cancel()` returns to the inventory list.
 *
 *   const overview = new CheckoutStepTwoPage(page);
 *   await overview.assertLoaded();
 *   expect(await overview.total()).toBe(
 *       await overview.itemTotal() + await overview.tax(),
 *   );
 *   await overview.finish();
 */
export class CheckoutStepTwoPage extends BasePage {
    static readonly PATH = '/playwright/ttacart/checkout-step-two.html';

    private readonly title: Locator;
    private readonly itemRows: Locator;
    private readonly itemNames: Locator;
    private readonly paymentInfo: Locator;
    private readonly shippingInfo: Locator;
    private readonly subtotalLabel: Locator;
    private readonly taxLabel: Locator;
    private readonly totalLabel: Locator;
    private readonly finishButton: Locator;
    private readonly cancelButton: Locator;

    constructor(page: Page) {
        super(page, 'CheckoutStepTwoPage');
        this.title = page.locator('[data-test="title"]');
        this.itemRows = page.locator('[data-test="inventory-item"]');
        this.itemNames = page.locator('[data-test="inventory-item-name"]');
        this.paymentInfo = page.locator('[data-test="payment-info-value"]');
        this.shippingInfo = page.locator('[data-test="shipping-info-value"]');
        this.subtotalLabel = page.locator('[data-test="subtotal-label"]');
        this.taxLabel = page.locator('[data-test="tax-label"]');
        this.totalLabel = page.locator('[data-test="total-label"]');
        this.finishButton = page.locator('[data-test="finish"]');
        this.cancelButton = page.locator('[data-test="cancel"]');
    }

    async assertLoaded(): Promise<void> {
        await expect(this.title).toContainText('Checkout: Overview');
        await expect(this.finishButton).toBeVisible();
    }

    async itemNamesList(): Promise<string[]> {
        return this.el.getAllTexts(this.itemNames);
    }

    async rowCount(): Promise<number> {
        return this.itemRows.count();
    }

    async paymentInformation(): Promise<string> {
        return this.el.getText(this.paymentInfo);
    }

    async shippingInformation(): Promise<string> {
        return this.el.getText(this.shippingInfo);
    }

    /** Item total before tax, e.g. "Item total: $29.99" -> 29.99. */
    async itemTotal(): Promise<number> {
        return CheckoutStepTwoPage.parseAmount(await this.el.getText(this.subtotalLabel));
    }

    async tax(): Promise<number> {
        return CheckoutStepTwoPage.parseAmount(await this.el.getText(this.taxLabel));
    }

    async total(): Promise<number> {
        return CheckoutStepTwoPage.parseAmount(await this.el.getText(this.totalLabel));
    }

    async finish(): Promise<void> {
        await this.el.click(this.finishButton);
        await this.page.waitForLoadState('domcontentloaded');
    }

    async cancel(): Promise<void> {
        await this.el.click(this.cancelButton);
        await this.page.waitForLoadState('domcontentloaded');
    }

    /** Pulls the numeric part out of a "<Label>: $12.34" summary line. */
    private static parseAmount(label: string): number {
        const match = label.match(/\$\s*([\d,]+(?:\.\d+)?)/);
        if (!match) {
            throw new Error(`No currency amount found in checkout label: "${label}"`);
        }
        return Number(match[1].replace(/,/g, ''));
    }
}
