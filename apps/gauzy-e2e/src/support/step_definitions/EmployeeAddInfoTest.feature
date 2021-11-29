Feature: Employee add info test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add employee
    And User can add new employee
  Scenario: Add employee level
    When User visit Add new employee level page
    Then User can see grid button
    And User can click on second grid button to change view
    And User can see Add new level button
    When User click on Add new level button
    Then User will see new level input
    And User can enter new level name
    And User can see tags multi-select
    When User click on tags multi-select
    Then User can select tag from dropdown menu
    And User can see Save button
    When User click on Save button
    Then User will see notification message
  Scenario: Add employee level and short description
    When User see dashboard button on main manu
    Then User click on dashboard button
    When User see employee selector
    Then User click on employee selector
    When User see employee dropdown
    Then User click on employee
    When User see edit icon button
    Then User click on edit icon button
    When User see Employment tab
    Then User click on Employment tab
    When User see Short Description input field
    Then User enter value for Short Description
    When User see level input field
    Then User click on level input field
    And User can select level from dropdown
    When User see save button
    Then User click on save button again
    Then User will see notification message
  Scenario: Verify employee information
    When User see dashboard button on main manu
    Then User click on dashboard button
    When User see employee selector
    Then User click on employee selector
    When User see employee dropdown
    Then User click on employee
    And User can verify employee short description
    And User can verify employee level