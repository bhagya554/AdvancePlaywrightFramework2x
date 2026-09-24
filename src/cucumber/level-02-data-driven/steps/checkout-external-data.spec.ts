import { CustomWorld,CRED } from "@src/cucumber/support/world";
import {Given,When,Then,DataTable} from '@cucumber/cucumber'
import {expect} from '@playwright/test'
import type { CheckoutCustomer } from "@src/utils/DataGenerator";
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

type CustomerBook=Record<string,CheckoutCustomer>;

const customers:CustomerBook=JSON.parse(
    readFileSync(join(__dirname,'../data/customers.json'),'utf-8')
);

//When I add the product "test-allthethings-tshirt-red" to the cart
When('I add the product {string} to the cart',async function(this:CustomWorld,productId:string){
    await this.inventoryPage.addToCart(productId)
})



//Bracket notation, keyed by name:
//And I checkout as the "<persona>" customer
When('I checkout as the {string} customer',async function(this:CustomWorld,customerName:string){
    const customer=customers[customerName]
    if(!customer){
        throw new Error(`No customer "${customerName} in customer.json"`);
    }

    await this.cartPage.open();
    await this.cartPage.checkout();
    await this.checkoutStepOnePage.fillGuest(customer)
    await this.checkoutStepOnePage.continue();
    await this.checkoutStepTwoPage.assertLoaded();
    await this.checkoutStepTwoPage.finish();
    
})

Then('The order should be confirmed',async function(this:CustomWorld){
    await this.checkoutCompletePage.assertOrderComplete();
})




 


