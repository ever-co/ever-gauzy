Feature: Goals test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    And User can add new tag
  Scenario: Add employee
    And User can add new employee
  Scenario: Add project
    And User can add new project
  Scenario: Add contact
    And User can add new contact
  Scenario: Add new goal
    And User can visit Goals page
    And User can see add goal button
    When User click on add goal button
    Then User can select first option from a dropdown
    And User can see name input field
    And User can enter value for name
    And User can see owner dropdown
    When User click on owner dropdown
    Then User can select owner from dropdown options
    And User can see contact dropdown
    When User click on contact dropdown
    Then User can select contact from dropdown options
    And User can see confirm button
    When User click on confirm button
    Then Notification message will appear
    And User can verify goal was created
  Scenario: Add key result
    And User can see goals table
    When User click on first table row
    Then Add button will become active
    When User click on add button
    Then User can see key result input field
    And User can enter value for key result
    And User can see key result owner dropdown
    When User click on key result owner dropdown
    Then User can select key result owner from dropdown options
    And User can see key result contact dropdown
    When User click on key result contact dropdown
    Then User can select key result owner from dropdown options
    And User can see toggle button
    And U ser can click on toggle button
    And User can see confirm button
    When User click on confirm button
    Then Notification message will appear
  Scenario: Edit goal
    And User can see edit goal button
    When User click on edit goal button
    Then User can see owner dropdown
    When User click on owner dropdown
    Then User can select owner from dropdown options
    And User can see confirm button
    When User click on confirm button
    Then Notification message will appear
  Scenario: Delete goal
    And View button will become active
    When User click on view button
    Then Delete button will become active
    When User click on delete button
    And User can see confirm button
    When User click on confirm button
    Then Notification message will appear
    And User can verify goal was deleted