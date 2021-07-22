Feature: Organization employment types test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    Then User can add new tag
  Scenario: Add new employment type
    And User can visit Organization employment types page
    And User can see grid button
    And User can click on grid button to change view
    And User can see add button
    When User click on add button
    Then User can see name input field
    And User can enter value for name
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see save button
    When User click on save button
    Then Notification messgae will appear
    And User can verify employment type was created
  Scenario: Edit employment type
    And User can see edit button
    When User click on edit button
    Then User can see edit name input field
    And User can enter new value for name
    And User can see save edited type button
    When User click on save edited type button
    Then Notification messgae will appear
    And User can verify employment type was edited
  Scenario: Delete employment type
    And User can see delete button
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification messgae will appear