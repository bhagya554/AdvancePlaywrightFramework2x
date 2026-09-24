@level2 @e2e @external
Feature: End-to-End checkout, data from an external JSON file (Level 2)

  Background:
    Given I am logged in as a standard user

  Scenario Outline: <persona> completes a full checkout
    When I add the product "test-allthethings-tshirt-red" to the cart
    And I checkout as the "<persona>" customer
    Then The order should be confirmed

    Examples:
      | persona |
      | alice   |
      | bob     |
      | carol   |
