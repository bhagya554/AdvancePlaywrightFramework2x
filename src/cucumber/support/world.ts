import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber'
import type { Browser, BrowserContext, Page } from '@playwright/test'

import { LoginPage } from '@pages/LoginPage'
import { InventoryPage } from '@pages/InventoryPage'
import { CartPage } from '@pages/CartPage'
import { CheckoutStepOnePage } from '@pages/CheckoutStepOnePage'
import { CheckoutStepTwoPage } from '@pages/CheckoutStepTwoPage'
import { CheckoutCompletePage } from '@pages/CheckoutCompletePage'


export const BASE_URL = process.env.BASE_URL ?? 'https://app.thetestingacademy.com';
export const CRED = {
    standardUser: process.env.STANDARD_USER ?? 'standard_user',
    password: process.env.TTA_SECRET ?? 'tta_secret',
} as const;
//With as const, TypeScript infers:
//readonly standardUser: string;
//readonly password: string;

export class CustomWorld extends World {
    //! here -  tells TypeScript:
    // "Trust me, this property will be assigned a value before it's used, even though I haven't initialized it here."
    browser!: Browser;
    context!:BrowserContext;
    page!:Page;

    loginPage!:LoginPage;
    inventoryPage!: InventoryPage;
    cartPage!: CartPage;
    checkoutStepOnePage!: CheckoutStepOnePage;
    checkoutStepTwoPage!: CheckoutStepTwoPage;
    checkoutCompletePage!: CheckoutCompletePage;

    //scratch - The name usually means:"Temporary storage area for the current scenario/test."
    //Think of it as a notebook attached to the World object.
    scratch:Record<string,unknown>={}

    constructor(options:IWorldOptions){
        super(options)
    }

    initPages():void{
        this.loginPage = new LoginPage(this.page);
        this.inventoryPage = new InventoryPage(this.page);
        this.cartPage = new CartPage(this.page);
        this.checkoutStepOnePage = new CheckoutStepOnePage(this.page);
        this.checkoutStepTwoPage = new CheckoutStepTwoPage(this.page);
        this.checkoutCompletePage = new CheckoutCompletePage(this.page);
    }
}

setWorldConstructor(CustomWorld)