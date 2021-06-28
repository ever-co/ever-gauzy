Feature: Login
  Scenario: Login with email test
    Given Visit home page as unauthorised user
    Then User can see login text
    And User cane see email input
    And Use can enter value for email
    And User cane see password input
    And Use can enter value for password
    When User click on login button
    Then User will see Create button
  Scenario: Logout after login with email
    When User click on username
    Then User can see and click on logout button
    And User can see again login text
