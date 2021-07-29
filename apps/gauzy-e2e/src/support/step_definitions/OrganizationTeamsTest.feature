Feature: Organization teams test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add new team
    And User can visit Organization teams page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add team button
    When User click on add team button
    Then User can see name input field
    And User can enter value for name
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see manager dropdown
    When User click on manager dropdown
    Then User can select manager from dropdown options
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: Edit team
    And User can see teams table
    When User click on teams table row
    Then Edit team button will become active
    When User click on edit team button
    Then User can see name input field again
    And User can enter new name
    And User can see save edited team button
    When User click on save edited team button
    Then Notification message will appear
  Scenario: Delete team
    And User can see teams table again
    When User click on teams table row again
    Then Delete team button will become active
    When User click on delete team button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear