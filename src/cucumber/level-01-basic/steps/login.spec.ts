import {Given,When,Then} from '@cucumber/cucumber'
import {CustomWorld} from "@src/cucumber/support/world";
import {expect} from "@playwright/test";

Given('I am on the TTACart login page',async function(this:CustomWorld){
    await this.loginPage.open();
})

When('I login as {string} with password {string}',async function(this:CustomWorld,username:string,password:string){
    await this.loginPage.loginAs(username,password)
})

Then('I should land on inventory page',async function(this:CustomWorld){
    await this.inventoryPage.assertLoaded();
})

Then('I should see a login error containing {string}',async function(this:CustomWorld,errorMsg:string){
    const error= this.page.locator("[data-test='error']");
    await expect(error).toBeVisible();
    await expect(error).toContainText(errorMsg);
})