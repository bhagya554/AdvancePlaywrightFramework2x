// Whatever the common utilities are there, it will be present in the util element locator.

/**
 * This is UtilElementLocators - Contains all the util we can reuse direclty
 *
 **/

import { expect, Locator, Page } from '@playwright/test'
import {createLogger,type Logger} from '@src/utils/logger'

export const DEFAULT_ACTION_TIMEOUT_MS = 15_000;

/**
 * Flex - a selector can be a CSS string or an already-built Locator.
 *
 * The TTACart suite uses `data-test` attributes everywhere, so most call sites
 * pass either:
 *   - `'[data-test="username"]'`  (a CSS string), or
 *   - `page.getByTestId('username')` (a Locator object).
 */

export type Flex = string | Locator

export class UtilElementLocator {
    private readonly page: Page
    private readonly log:Logger

    constructor(page: Page,scope:string='UtilElementLocator') {
        this.page = page;
        this.log=createLogger(scope)
    }

    private toLocator(target: Flex): Locator {
        return typeof target === 'string' ? this.page.locator(target) : target
    }

    /** Human-readable label for a target, used only in log lines. */
    private describe(target: Flex): string {
        return typeof target === 'string' ? target : target.toString()
    }

    // ---------- mouse actions ----------
    async click(target: Flex, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        // Checking if it is a normal locator or a Playwright locator.
        const loc = this.toLocator(target)
        this.log.debug(`click ${this.describe(target)}`)
        await loc.click({ timeout })
    }

    async doubleClick(target: Flex, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target)
        this.log.debug(`doubleClick ${this.describe(target)}`)
        await loc.dblclick({ timeout })
    }

    async rightClick(target: Flex, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target)
        this.log.debug(`rightClick ${this.describe(target)}`)
        await loc.click({ button: 'right', timeout })
    }

    async hover(target: Flex, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target)
        this.log.debug(`hover ${this.describe(target)}`)
        await loc.hover({ timeout })
    }

    // ---------- input actions ----------
    async fill(target: Flex, value: string, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target)
        this.log.debug(`fill ${this.describe(target)} with "${value}"`)
        await loc.fill(value, { timeout })
    }

    // Note: Playwright deprecated .type() in favour of .pressSequentially().
    // We keep the public method name so the API still reads naturally for
    // students used to the older verb.
    async type(target: Flex, value: string, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target)
        this.log.debug(`type ${this.describe(target)} with "${value}"`)
        await loc.pressSequentially(value, { timeout })
    }

    async pressSequencially(target: Flex, value: string, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target)
        this.log.debug(`pressSequencially ${this.describe(target)} with "${value}"`)
        await loc.pressSequentially(value, { timeout })
    }

    async clear(target: Flex, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target)
        this.log.debug(`clear ${this.describe(target)}`)
        await loc.clear({ timeout })
    }

    // ---------- text & content getters ----------
    // ?? '' is the nullish operator in JavaScript/TypeScript.
    // It means:"If the value on the left is null or undefined, use the value on the right instead."

    //As loc.textContent() can return: null | string,If it returns null then const text='',
    //Ensures text is always a string

    async getText(target: Flex): Promise<string> {
        const loc = this.toLocator(target)
        const text = (await loc.textContent()) ?? ''
        this.log.debug(`getText ${this.describe(target)} -> "${text.trim()}"`)
        return text.trim()
    }

    async getInnerText(target: Flex): Promise<string> {
        const loc = this.toLocator(target)
        const text = await loc.innerText()
        this.log.debug(`getInnerText ${this.describe(target)} -> "${text.trim()}"`)
        return text.trim()
    }

    async getAllTexts(target: Flex): Promise<string[]> {
        const loc = this.toLocator(target)
        const texts = await loc.allTextContents()
        const trimmed = texts.map((t) => t.trim())
        this.log.debug(`getAllTexts ${this.describe(target)} -> ${trimmed.length} item(s)`)
        return trimmed
    }

    async getAttribute(target: Flex, name: string): Promise<string | null> {
        const loc = this.toLocator(target)
        const value = await loc.getAttribute(name)
        this.log.debug(`getAttribute ${this.describe(target)} [${name}] -> ${value}`)
        return value
    }

    async getValue(target: Flex): Promise<string> {
        const loc = this.toLocator(target)
        const value = await loc.inputValue()
        this.log.debug(`getValue ${this.describe(target)} -> "${value}"`)
        return value
    }

    // ---------- count ----------

    async count(target: Flex): Promise<number> {
        const loc = this.toLocator(target);
        const n = await loc.count();
        this.log.debug(`count ${this.describe(target)} -> ${n}`)
        return n;
    }

    // ---------- state checks ----------

    async isVisible(target: Flex): Promise<boolean> {
        const loc = this.toLocator(target);
        const visible = await loc.isVisible();
        this.log.debug(`isVisible ${this.describe(target)} -> ${visible}`)
        return visible;
    }

    async isEnabled(target: Flex): Promise<boolean> {
        const loc = this.toLocator(target);
        const enabled = await loc.isEnabled();
        this.log.debug(`isEnabled ${this.describe(target)} -> ${enabled}`)
        return enabled;
    }

    async isChecked(target: Flex): Promise<boolean> {
        const loc = this.toLocator(target);
        const checked = await loc.isChecked();
        this.log.debug(`isChecked ${this.describe(target)} -> ${checked}`)
        return checked;
    }

    // ---------- waits ----------
    async waitForVisible(target: Flex, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target);
        this.log.debug(`waitForVisible ${this.describe(target)}`)
        return expect(loc).toBeVisible({ timeout });
    }

    async waitForHidden(target: Flex, timeout: number = DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
        const loc = this.toLocator(target);
        this.log.debug(`waitForHidden ${this.describe(target)}`)
        return expect(loc).toBeHidden({ timeout });
    }

    async waitForPageLoad(): Promise<void> {
        this.log.debug('waitForPageLoad')
        await this.page.waitForLoadState('domcontentloaded')
        // Why catch?
        // "Try to wait for network idle. If it succeeds, great.
        // If it times out, ignore the error and continue."
        await this.page.waitForLoadState('networkidle').catch(() => {
            this.log.debug('networkidle timed out, continuing')
        })
    }

    // ---------- selects ----------
    async selectByText(target: Flex, text: string): Promise<void> {
        const loc = this.toLocator(target);
        this.log.debug(`selectByText ${this.describe(target)} -> "${text}"`)
        await loc.selectOption({ label: text });
    }

    async selectByIndex(target: Flex, index: number): Promise<void> {
        const loc = this.toLocator(target);
        this.log.debug(`selectByIndex ${this.describe(target)} -> ${index}`)
        await loc.selectOption({index});
    }

    async selectByValue(target: Flex, value: string): Promise<void> {
        const loc = this.toLocator(target);
        this.log.debug(`selectByValue ${this.describe(target)} -> "${value}"`)
        await loc.selectOption({value});
    }

}
