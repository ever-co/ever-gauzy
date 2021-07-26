Feature: Organization recurring expense test
  Scenario: Login with email
    Given Login with default credentials and visit Organization expenses page
  Scenario: Add new expense
    And User can see add button
    When User click on add button
    Then User can see expense dropdown
    When User click expense dropdown
    Then User can select expense from dropdown options
    And User can see expense value input field
    And User can enter value for expense
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify expense was created
  Scenario: Edit expense
    And User can see settings button
    When User click on settings button
    Then User can see edit button
    When User click on edit button
    Then User can see expense dropdown again
    When User click on expense dropdown
    Then User can select new expense from dropdown options
    And User can see expense value input field again
    And User can enter new value for expense
    And User can see save edited expense button
    When User click on save edited expense button
    Then Notification message will appear
  Scenario: Delete expense
    And User can see settings button again
    When User click on settings button again
    Then User can see delete button
    When User click on delete button
    Then User can see radio button
    When User click on radio button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear