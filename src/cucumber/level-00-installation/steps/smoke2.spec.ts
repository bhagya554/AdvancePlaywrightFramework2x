import {Given,When,Then} from '@cucumber/cucumber'
import {CustomWorld,CRED} from "@src/cucumber/support/world";

Given('I am on the TTACart login Page',async function(this:CustomWorld){
    await this.loginPage.open();
})

When('I log in as the standard user',async function(this:CustomWorld){
    await this.loginPage.loginAs(CRED.standardUser,CRED.password);
})

Then('the inventory page is displayed',async function(this:CustomWorld){
    await this.inventoryPage.assertLoaded();
})

