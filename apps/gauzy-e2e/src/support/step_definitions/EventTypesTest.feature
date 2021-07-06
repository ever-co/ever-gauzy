Feature: Event types test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add new event type
    And User can visit Event types page
    Then User can see grid button
    And User can click on second grid button to change view
    And User can see add event type button
    When User click on add event type button
    Then User can see employee dropdown
    When User click on employee dropdown
    Then User can select epmloyee from dropdown options
    And User can see title input field
    And User can enter value for title
    And User can see description input field
    And User can enter value for description
    And User can see duration input field
    And User can select value for duration
    And User can checkbox
    And User can click on checkbox
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: Edit event type
    Then User can see events table
    When User click on first table row
    Then Edit button will become active
    When User click on edit button
    Then User can see title input field
    And User can enter value for title
    And User can see description input field
    And User can enter value for description
    And User can see duration input field
    And User can select value for duration
    And User can checkbox
    And User can click on checkbox
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: Delete event type
    And User can see events table
    When User click on first table row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    And User click on confirm delete button
    Then Notification message will appear