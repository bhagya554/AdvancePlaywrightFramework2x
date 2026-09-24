import { CustomWorld,CRED } from "@src/cucumber/support/world";
import {Given,When,Then,DataTable} from '@cucumber/cucumber'
import {expect} from '@playwright/test'


//cart-datatable.feature:: Background > Given I am logged in as a standard user
Given('I am logged in as a standard user',async function(this:CustomWorld){
    await this.loginPage.open();
    await this.loginPage.loginAs(CRED.standardUser,CRED.password);
    await this.inventoryPage.assertLoaded();
})

//cart-datatable.feature:: Background > And I am on the products page
Given('I am on the products page',async function(this:CustomWorld){
    await this.inventoryPage.open();
    })

When('I add following products to the cart:',async function(this:CustomWorld,dataTable:DataTable){
const products=dataTable.hashes()
for (const product of products) {
    await this.inventoryPage.addToCart(product.productId);
    }
})
//In Cucumber Expressions, use {int} for integers, not {number}.
Then('the cart should contain {int} products',async function(this:CustomWorld,reqCount:number){
    await this.cartPage.open();
    await this.cartPage.assertLoaded();
    const count =await this.cartPage.rowCount();
    expect(count).toBe(reqCount);
})