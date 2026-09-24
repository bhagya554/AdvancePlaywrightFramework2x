@level2 @outline
Feature: TTACart login outcomes(Level 2 - Scenario Outline)

  Background:
    Given I am on TTACart login page

  Scenario Outline: Successful login
    When I log in as "<username>" with password "<password>"
    Then I should see the products page

    Examples: valid users
      | username                | password   |
      | standard_user           | tta_secret |
      | problem_user            | tta_secret |
      | performance_glitch_user | tta_secret |

  Scenario Outline: Failed login
    When I log in as "<username>" with password "<password>"
    Then I should see an error message containing "<errorText>"

    Examples: rejected attempts
      | username        | password       | errorText    |
      | locked_out_user | tta_secret     | locked out   |
      | standard_user   | wrong_password | do not match |
