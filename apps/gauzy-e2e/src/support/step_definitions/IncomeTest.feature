Feature: Income test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add income
    Then User can visit Income page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add income button
    When User click on add income button
    Then User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see date input field
    And User can enter value for date
    And User can see contact input field
    And User can enter value for contact
    And User can see amount input field
    And User can enter value for amount
    And User can see notes textarea input field
    And User can add value for notes
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify income was created
  Scenario: Edit income
    When User select incomes first table row
    Then Edit income button will become active
    When User click on edit income button
    Then User can see date input field
    And User can enter value for date
    And User can see contact input field
    And User can enter value for contact
    And User can see amount input field
    And User can enter value for amount
    And User can see notes textarea input field
    And User can add value for notes
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify income was created
  Scenario: Delete income
    When User select incomes first table row
    Then Delete income button will become active
    When User click delete income button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear