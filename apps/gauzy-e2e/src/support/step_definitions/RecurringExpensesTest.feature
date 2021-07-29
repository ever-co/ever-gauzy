Feature: Recurring expense test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add new expense
    And User can visit Employees recurring expense page
    And User can see add new expense button
    When User click on add new expense button
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see expense dropdown
    When User click on expense dropdown
    Then User can select expense from dropdown options
    And User can see expense value input field
    And User can enter expense value
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: Edit expense
    And User can see settings button
    When User click on settings button
    Then User can see edit button
    When User click on edit button
    Then User can see expense value input field again
    And User can enter new expense value
    And User can see save button again
    When User click on save button again
    Then Notification message will appear
  Scenario: Delete expense
    And User can see settings button again
    When User click on settings button again
    Then User can see delete button
    When User click on delete button
    Then User can see delete all button
    When User click on delete all button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear