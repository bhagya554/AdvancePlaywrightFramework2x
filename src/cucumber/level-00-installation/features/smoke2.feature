@level0 @smoke
Feature: TTACart Login(level0)
Verifies the Cucumber+Playwright wiring end to end by driving the  Page Objects 
exposed on the Custom World.

  Scenario: A standard user can log in and reach the inventory
    Given I am on the TTACart login Page
    When I log in as the standard user
    Then the inventory page is displayed
