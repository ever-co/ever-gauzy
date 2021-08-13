Feature: Proposals test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add new proposal
    And User can visit Sales proposals page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see register proposal button
    When User click on register proposal button
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see job post input field
    And User can enter job post url
    And User can see date input field
    And User can enter value for date
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can enter job proposal content
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: Edit proposal
    And User can see proposals table
    When User click on proposals table row
    Then User can see details button
    When User click on details button
    Then User can see edit proposal button
    When User click on edit proposal button
    Then User can see job proposal input field again
    And User can enter new job proposal url
    And User can see save edited proposal button
    When User click on save edited proposal button
    Then Notification message will appear
  Scenario: Mark proposal as Accepted
    And User can see proposals table again
    When User click on proposals table row again
    Then User can see status button
    When User click on status button
    Then User can see confirm button
    When User click on confirm button
    Then Notification message will appear
  Scenario: Delete proposal
    And User can see again proposals table
    When User click again on proposals table row
    Then User can see delete proposal button
    When User click on delete proposal button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear