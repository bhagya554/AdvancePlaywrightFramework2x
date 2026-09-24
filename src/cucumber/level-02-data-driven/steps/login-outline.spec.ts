import { CustomWorld,CRED } from "@src/cucumber/support/world";
import {Given,When,Then,DataTable} from '@cucumber/cucumber'
import {expect} from '@playwright/test'


//login-outline.feature:: Background: Given I am on TTACart login page
Given('I am on TTACart login page',async function(this:CustomWorld){
    await this.loginPage.open();
})

//login-outline.feature:: When I log in as "<username>" with password "<password>"
When('I log in as {string} with password {string}',async function(this:CustomWorld,username:string,password:string){
    await this.loginPage.loginAs(username,password)
})

//you can have this Then statement in your feature file. As of now this statement is deleted and sent as 2 then statements
//login-outline.feature:: Then I should see the "<outcome>" and has error message containing "<errorText>"
Then('I should see the {string} and has error message containing {string}',async function(this:CustomWorld,outcome:string,errorText:string){
    if(outcome==='products'){
        await this.inventoryPage.assertLoaded();
    }
    else{
        const error= this.page.locator("[data-test='error']");
        await expect(error).toBeVisible();
        await expect(error).toContainText(errorText);
    }
})

Then('I should see the products page',async function(this:CustomWorld){
    await this.inventoryPage.assertLoaded();
})

Then('I should see an error message containing {string}',async function(this:CustomWorld,errorText:string){
    const error= this.page.locator("[data-test='error']");
        await expect(error).toBeVisible();
        await expect(error).toContainText(errorText);
})