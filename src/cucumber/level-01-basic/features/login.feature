@level1 @login
Feature: TTA Cart Login

  Background:
    Given I am on the TTACart login page

  @smoke @p0
  Scenario: A standard-user can login
    When I login as "standard_user" with password "tta_secret"
    Then I should land on inventory page

  @negative
  Scenario: A locked-out user is refused
    When I login as "locked_out_user" with password "tta_secret"
    Then I should see a login error containing "locked out"

  @negative
  Scenario: Login via wrong password is rejected
    When I login as "standard_user" with password "wrong_password"
    Then I should see a login error containing "do not match"
