Feature: Time sheet test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add employee
    And User can add new employee
  Scenario: Add new client
    And User can add new client
  Scenario: Add time
    And User can visit Employees timesheets daily page
    And User can see add time log button
    When User click on add time log button
    Then User can see date input field
    And User can enter date
    And User can see start time dropdown
    When User click on start time dropdown
    Then User can select time from dropdown options
    And User can see client dropdown
    When User click on client dropdown
    Then User can select client from dropdown options
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see time log description input field
    And User can enter time log description
    And User can see save time log button
    When User click on save time log button
    Then Notification message will appear
  Scenario: View time
    And User can see view time log button
    When User click on view time log button
    Then User can see close time log popover button
    When User click on close time log popover button
  Scenario: Edit time
    Then User can see edit time log button
    When User click on edit time log button
    And User can see description input field again
    And User can enter new description
    And User can see save edited time log button
    When User click on save edited time log button
    Then Notification message will appear
  Scenario: Delete time
    And User can see delete time log button
    When User click on delete time log button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear