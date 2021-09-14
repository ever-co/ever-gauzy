Feature: Time tracking with pause test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    Then User can add new employee
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
  Scenario: Add time
    And Employee can see timer
    When Employee click on timer
    Then Employee can see timer button
    When Employee click on timer button
    And Employee can see start timer button
    When Employee click on start timer button
    Then Employee can let timer work for 5 seconds
    And Employee can see stop timer button
    When Employee click on stop timer button
    And Employee wait button to change
    Then Employee can see again start timer button
    When Employee click on start timer button
    Then Employee can let timer work for 5 seconds
    And Employee can see stop timer button again
    When Employee click on stop timer button
    Then Employee can see again start timer button
    Then Employee can see view timesheet button
    When Employee click on view timesheet button
    Then Employee verify first time record
    And Employee verify second time record
    Then Employee can see first delete button
    And Employee can see second delete button
    When Employee click on delete button
    Then Employee can see confirm dialog
    When Employee can click confirm dialog button
    Then Employee refresh
    Then Employee can verify time

    
  