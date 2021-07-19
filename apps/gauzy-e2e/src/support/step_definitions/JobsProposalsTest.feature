Feature: Job Proposals test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    And User can add new employee
  Scenario: Add new proposal
    And User can visist Jobs proposals page
    Then User can see add button
    When User click on add button
    Then User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see name input field
    And User can enter value for name
    And User can see content input field
    And User can enter value for content
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify job proposal was created
  Scenario: Edit proposal
    When User select proposals first table row
    Then Edit button will become active
    When User click on edit button
    Then User will see name input field
    And User can edit name value
    And User can see save button again
    When User click on save button again
    Then Notification message will appear
    And User can verify job proposal was edited
  Scenario: Make proposal default
    When User select first table row
    Then Make dafault button will become active
    When User click on make default button
    Then Notification message will appear
  Scenario: Delete proposal
    When User select first table row again
    Then Delete button will become active
    When User click on delete button
    Then User will see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
    And User can verify porposal was deleted