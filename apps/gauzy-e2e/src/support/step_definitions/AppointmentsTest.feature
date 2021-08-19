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
