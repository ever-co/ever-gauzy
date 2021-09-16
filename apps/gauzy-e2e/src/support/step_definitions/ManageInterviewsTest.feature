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
  Scenario: Add interview feedback
    And User navigates to Candidates interview panel
    And User can see name filter input field
    And User enters name filter input value
    And User can see title filter input field
    When User enters title filter input value
    Then User can see filtered candidate
    And User can see Add Feedback button
    When User clicks on Add Feedback button
    Then User can see Add Interview dropdown
    When User clicks on Add Interviewer dropdown
    Then User can select Interviewer from dropdown options
    And User can see Rating input
    And User clicks on Rating input
    And User can see Radio group
    And User clicks on a Radio option
    And User can see Feedback description input field
    And User enters value for Feedback description
    And User can see feedback save button
    When User clicks on save button
    Then Notification message will appear
    And User clears filter input
  Scenario: Add future interview
    When User click on add interview button
    Then User can see candidate dropdown
    When User click on candidate dropdown
    Then User can select candidate from dropdown options
    And User can see title input field
    And User can enter value for title for a future interview
    And User can see date input field
    And User can enter value for a future date
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
    Then Notification message will appear second
  Scenario: Edit future interview
    And User can see Only Future checkbox
    And User clicks on Only Future checkbox
    And User can see name filter input field
    And User enters name filter input value
    And User can see title filter input field
    When User enters title filter input value for future interview
    And User can see Edit interview button
    And User can see future checkbox
    Then User click future checkbox
    And User clicks Edit interview button
    And User can see note input field
    And User can enter value for updated note
    And User can see next button
    When User click on next button
    Then User will see next step button
    When User click on next step button
    Then User will notify candidate button
    When User can click on notify candidate button
    Then User can see save button
    When User click on save button
    Then Notification message will appear
    And User can see updated note
  Scenario: Archive future interview
    And User can see Archive option
    When User clicks on Archive option
    Then User can see Ok button
    When User clicks on Ok button
    Then Notification message will appear
    And User can see Include Archived checkbox
    When User clicks on Include Archived button
    Then User can see Archived badge
  Scenario: Delete future interview 
    And User can see Delete option
    When User clicks on Delete option
    Then User can see Delete button
    When User clicks on Delete button
    Then Notification message will appear
    And User clears filters