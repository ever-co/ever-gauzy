Feature: Project tracked in timesheets test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    Then User can add new employee
  Scenario: Add new project
    And User can visit Organization projects page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see request project button
    When User click on request project button
    Then User can see name input field
    And User can enter value for name
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropodown options
    And User can see save project button
    When User click on save project button
    Then Notification message will appear
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
  Scenario: Record time with the new project
    And Employee can see timer
    When Employee click on timer
    Then Employee can see timer button
    And Employee can see project select
    When Employee click on project select
    Then Employee can select project from dropdown options
    When Employee click on start timer button
    Then Employee can let timer work for 5 seconds
    And Employee can see stop timer button
    When Employee click on stop timer button
    Then Employee can see view timesheet button
    When Employee click on view timesheet button
    Then Employee verify project name is the same