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
  Scenario: Create task and verify
    When Employee go to my tasks
    Then Employee can see add button
    When Employee click on add button
    Then Employee can see project dropdown
    When Employee click on project dropdown
    Then Employee can select project from dropdown options
    And Employee can see status dropdown
    When Employee click on status dropdown
    Then Employee can select status from dropdown options
    And Employee can see title input field
    And Employee can enter title
    And Employee can see tags dropdown
    When Employee click on tags dropdown
    Then Employee can select tag from dropdown options
    And Employee can see due date input field
    And Employee can enter due date
    And Employee can see estimate days input field
    And Employee can enter estimate days
    And Employee can see estimate hours input field
    And Employee can enter estimate hours
    And Employee can see estimate minutes input field
    And Employee can enter estimate minutes
    And Employee can see task description input field
    And Employee can enter task description
    And Employee can see task save button
    When Employee click on save task button
    Then Notification message will appear
  Scenario: Record time with the new task
    And Employee can see timer
    When Employee click on timer
    Then Employee can see timer button
    And Employee can see task select
    When Employee click on task select
    Then Employee can select task from dropdown options
    When Employee click on start timer button
    Then Employee can let timer work for 5 seconds
    And Employee can see stop timer button
    When Employee click on stop timer button
    Then Employee can see view timesheet button
    When Employee click on view timesheet button
    Then Employee verify project name is the same