Feature: Reports test
  Scenario: Login with email
    Given Login with default credentials and visit Reports page
  Scenario: Verify Time tracking
    And User can verify Time tracking content
    And User can verify Time tracking settings state
  Scenario: Payments tracking
    And User can verify Payments content
    And User can verify Payments settings state
  Scenario: Time Off tracking
    And User can verify Time Off content
    And User can verify Time Off settings state
  Scenario: Invoices tracking
    And User can verify Invoices content
    And User can verify Invoices settings state
  Scenario: Add new tag
    And User can add new tag
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
    And Newly created employee can log in
  Scenario: Add time
    And Employee can log time
  Scenario: Verify reports time log data
    And Employee can see Reports sidebar button
    When Employee click on Reports sidebar button
    Then Employee can click on Time & Activity sidebar button
    And Employee can see activity level button
    When Employee click on activity level button
    Then Employee can see activity slider
    And Employee can change slide value to filter reports data
    Then Employee can click again on activity level button to hide slider
    And Employee can verify time logged by total hours
    And Employee can verify Time and Activity project worked
    When Employee can click on Amounts owed sidebar button
    Then Employee can verify his own name under employee section
    When Employee click on Projects budgets sidebar button
    Then Employee can verify project that he worked on
    When Employee click on Clients budgets sidebar button
    Then Employee can verify projects client
    And User can verify budget progress bar