Feature: Manage interviews test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add candidate
    And User can add new candidate
  Scenario: Add interview
    And User can visit Candidates interviews calendar page
    And User can see add interview button
    When User click on add interview button
    Then User can see candidate dropdown
    When User click on candidate dropdown
    Then User can select candidate from dropdown options
    And User can see title input field
    And User can enter value for title
    And User can see date input field
    And User can enter value for date
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see interview type button
    When User click on interview type button
    Then User can see location input field
    And User can enter value for location
    And User can see note input field
    And User can enter value for note
    And User can see next button
    When User click on next button
    Then User will see next step button
    When User click on next step button
    Then User will notify candidate button
    When User can click on notify candidate button
    Then User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify interview was scheduled for candidate