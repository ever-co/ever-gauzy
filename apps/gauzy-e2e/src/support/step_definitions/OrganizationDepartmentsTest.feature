Feature: Organization departments test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    Then User can add new tag
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add project
    And User can add new project
  Scenario: Add department
    When User go to Organization departments page
    Then User will see grid button
    And User can click on second grid button to change view
    And User can see add new department button
    When User click on add new department button
    Then User will see name input field
    And User can enter value for name
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see save department button
    When User click on save department button
    Then Notification message will appear
    And User can verify department was created
  Scenario: Edit department
    And User can see departments table
    When User click on departments table row
    Then Edit department button will become active
    When User click on edit department button
    Then User can see edit department name input field
    And User can enter new value for department name
    And User can save edited department button
    When User click on save edited department button
    Then Notification message will appear
    And User can verify department was edited
  Scenario: Delete department
    And User can see departments table again
    When User click on departments table row again
    Then Delete department button will become active
    When User click on delete department button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
    And User can verify department was deleted