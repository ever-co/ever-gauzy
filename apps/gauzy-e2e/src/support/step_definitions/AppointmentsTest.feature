Feature: Appointments test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    And User can add new employee
  Scenario: Add employee schedule
    And User can visit Employees appointments page
    And User can see employee select dropdown
    When User click on employee select dropdown
    Then User can select employee from dropdown options
    And User can see Schedules button
    When User clicks on Schedules button
    Then User can san see Date Specific Availability tab
    When User clicks Date Specific Availability tab
    Then User can see Calendar table
    When User clicks on Calendar table row
    Then Notification message will appear
  Scenario: Add new event type
    And User can visit Event types page
    Then User can see grid button
    And User can click on second grid button to change view
    And User can see add event type button
    When User click on add event type button
    Then User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options second
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
    And User can visit Event types page
    Then User can see grid button
    And User can click on second grid button to change view
    And User can see add event type button
    When User click on add event type button
    Then User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options second
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
  Scenario: Book public appointment
    And User can visit Employees appointments page
    And User can see employee select dropdown
    When User click on employee select dropdown
    Then User can select employee from dropdown options
    And User can see Book Public Appointment button
    When User click on Book Public Appointment button
    Then User can see Event Type Select button
    When User clicks on Event Type select button
    Then User can see available time in Calendar table
    When User clicks on available time in Calendar table
    Then User can see Agenda input field
    And User enters Agenda input field data
    And User can see Buffer time checkbox
    When User clicks on Buffer time checkbox
    Then User can see Buffer minutes input field
    And User enters Buffer minutes input field data
    And User can see Break time checkbox
    When User clicks on Break time checkbox
    Then User can see Break time date dropdown
    When User clicks on Break time date dropdown
    Then User can select Break time from dropdown options
    And User can see Break time minutes input field
    And User enters Break time minutes input field data
    And User can see location input field
    And User enters location input field data
    And User can see description input field
    And User enters description input field data
    And User can see Save button
    When User clicks on Save button
    Then Notification message will appear
  Scenario: Verify appointment
    And User can verify appointment title
    And User can verify employee name
    And User can verify agenda
    And User can verify location
    And User can verify description