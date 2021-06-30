Feature: Custom SMTP test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new transfer protocol
    Then User can visit Custom SMTP page
    And User can see host input field
    And User can enter value for host
    And User can see port input field
    And User can enter value for port
    And User can see secure dropdown
    When User click on secure dropdown
    Then User can select option from dropdown
    And User can see username input field
    And User can enter value for username
    And User can see password input field
    And User can enter value for password
    And User can see save button
    And User can click on save button