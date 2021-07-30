Feature: Tasks team test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add project
    And User can add new project
  Scenario: Add team
    And User can add new team
  Scenario: Add new task
    And User can visit Tasks team page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add task button
    When User click on add task button
    Then User can see project dropdown
    When User click on project dropdown
    Then User can select project from dropdown options
    And User can see status dropdown
    When User click on status dropdown
    Then User can select status from dropdown options
    And User can see team dropdown
    When User click on team dropdown
    Then User can select team from dropdown options
    And User can see title input field
    And User can enter title
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see due date input field
    And User can enter due date
    And User can see estimate days input field
    And User can enter estimate days
    And User can see estimate hours input field
    And User can enter estimate hours
    And User can see estimate minutes input field
    And User can enter estimate minutes
    And User can see task description input field
    And User can enter task description
    And User can see task save button
    When User click on save task button
    Then Notification message will appear
  Scenario: Duplicate task
    And User can see tasks table
    When User select tasks table row
    Then Duplicate task button will become active
    When User click on duplicate task button
    Then User can see confirm duplicate task button
    When User click on confirm duplicate task button
    Then Notification message will appear
  Scenario: Edit task
    And User can see tasks table again
    When User select tasks table row again
    Then Edit task button will become active
    When User click on edit task button
    Then User can see title input field again
    And User can enter new title
    And User can see save edited task button
    When User click on save edited task button
    Then Notification message will appear
  Scenario: Delete task
    And User can see again tasks table
    When User select again tasks table row
    Then Delete task button will become active
    When User click on delete task button
    Then User can see confirm delete task button
    When User click on confirm delete task button
    Then Notification message will appear