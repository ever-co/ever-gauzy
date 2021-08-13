Feature: Time tracking test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add employee
    And User can add new employee
  Scenario: Add new project
    And User can add new project
  Scenario: Add new client
    And User can add new client
  Scenario: Add new task
    And User can add new task
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
    Then Employee can see client dropdown
    When Employee click on client select
    Then Employee can select client from dropdown options
    And Employee can see project select
    When Employee click on project select
    Then Employee can select project from dropdown options
    And Employee can see task select
    When Employee click on task select
    Then Employee can select task from dropdown options
    And Employee can see description input field
    And Employee can enter description
    And Employee can see start timer button
    When Employee click on start timer button
    Then Employee can let timer work for 5 seconds
    And Employee can see stop timer button
    When Employee click on stop timer button
    Then Employee can see again start timer button
    And Employee can see close button
    When Employee click on close button
    Then User can see tab button
    When User click on second tab button
    Then Employee can verify time was recorded
    And Employee can verify project worked
    And Employee can verify tasks worked
  Scenario: Add manual time
    And Employee can go back to dashboard tab
    When Employee click on timer again
    Then Employee can see manual time button
    When Employee click on manaul time button
    Then Employee can see date input field
    And Employee can enter date
    And Employee can see start time select
    When Employee click on start time select
    Then Employee can select start time from dropdown options
    And Employee can see end time select
    When Employee click on end time select
    Then Employee can select end time from dropdown options
    And Employee can see client dropdown again
    When Employee click on client select again
    Then Employee can select client from dropdown options again
    And Employee can see project select again
    When Employee click on project select again
    Then Employee can select project from dropdown options again
    And Employee can see task select again
    When Employee click on task select again
    Then Employee can select task from dropdown options again
    And Employee can see description input field again
    And Employee can enter description again
    And Employee can see add time button
    When User click on add time button
    Then Notification message will appear
    And User can see view timesheet button
    When User click on view timesheet button
    Then User can verify manual time was added