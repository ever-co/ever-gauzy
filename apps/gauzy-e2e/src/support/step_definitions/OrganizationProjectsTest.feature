Feature: Organization projects test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    And User can add new tag
  Scenario: Add employee
    And User can add new employee
  Scenario: Add new project
    And User can visit Organization projects page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see request project button
    When User click on request project button
    Then User can see name input field
    And User can enter value for name
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can navigate to second section
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can navigate to next section
    And User can see budget hours input field
    And User can enter value for budget hours
    And User can navigate to last section
    And User can see color input field
    And User can enter value for color
    And User can see save project button
    When User click on save project button
    Then Notification message will appear
  Scenario: Edit project
    And User can see projects table
    When User click on projects table row
    Then Edit project button will become active
    When User click on edit project button
    Then User can see edit name input field
    And User can enter new value for name
    And User can go to next section
    And User can see edit budget hours input field
    And User can enter new value for budget hours
    And User can go to last section
    And User can see edit color input field
    And User can enter new value for color
    And User can see save edited project button
    When User click on save edited project button
    Then Notification message will appear
  Scenario: Delete project
    And User can see projects table again
    When User click on projects table row again
    Then Delete project button will become active
    When User click on delete project button
    Then User can see confirm delete project button
    When User click on confirm delete project button
    Then Notification message will appear