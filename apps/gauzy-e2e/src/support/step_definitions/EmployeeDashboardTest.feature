Feature: Employee dashboard test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    And User can add new employee
  Scenario: Add new project
    And User can add new project
  Scenario: Add new client
    And User can add new client
  Scenario: Add employee salary
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
    And User click on currency input field
    And User select currency
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: Add income for employee
    When User see Accounting button
    Then User click on Accounting button
    When User see income button
    Then User click on income button
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add income button
    When User click on add income button
    Then User can see employee dropdown again
    When User click on employee dropdown again
    Then User can select employee from dropdown options again
    And User can see date input field
    And User can enter value for date
    And User can see contact input field
    And User can enter value for contact
    And User click on currency input field
    And User select currency
    And User can see amount input field
    And User can enter value for amount
    And User can see notes textarea input field
    And User can add value for notes
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: User go to dashboard to verify employee salary
    When User see dashboard button on main manu
    Then User click on dashboard button
    When User see employee selector
    Then User click on employee selector
    When User see employee dropdown
    Then User click on employee
    And User can verify salary
    And User can verify income