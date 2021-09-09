Feature: Time tracking for client test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    Then User can add new employee
  Scenario: Add new client
    And User can add new client
  Scenario: Logout
    And User can logout
  Scenario: Login as employee
    And Employee can see login page
    And Employee can see email input
    And Employee can enter value for employee email
    And Employee can see password input
    And Employee can enter value for employee password
    When Employee click on login button
    Then Employee will see Create button
  Scenario: Record time for the new client and verify
    And Employee can see timer
    When Employee click on timer
    Then Employee can see timer button
    And Employee can see client select
    When Employee click on client select
    Then Employee can select client from dropdown options
    When Employee click on start timer button
    Then Employee can let timer work for 5 seconds
    And Employee can see stop timer button
    When Employee click on stop timer button
    Then Employee can see view timesheet button
    When Employee click on view timesheet button
    Then Employee can see view button
    When Employee click on view button
    Then Employee can verify the customer name is recorded
