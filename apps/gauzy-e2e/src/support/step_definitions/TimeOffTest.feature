Feature: Time off request test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    And User can add new employee
  Scenario: Add new policy
    And User can visit Employees time off page
    And User can see time off settings button
    When User click on time off settings button
    Then User can see add new policy button
    When User click on add new policy button
    Then User can see policy input field
    And User can enter polciy name
    And User can see employee select dropdown
    When User click on employee select dropdown
    Then User can select employee from dropdown select options
    And User can see save new policy button
    When User click on save new policy button
    Then Notification message will appear
    And User can see back button
    When User click on back button
  Scenario: Create new time off request
    Then User can see request button
    When User click on request button
    Then User can see eployee select
    When User click employee select
    Then User can see employee dropdown
    And User can select employee from dropdown options
    And User can see time off policy select
    When User click on time off policy select
    Then User can see time off policy dropdown
    And User can select time off policy from dropdown options
    And User can see start date input field
    And User can enter start date
    And User can see end date input field
    And User can enter and date
    And User can see description input field
    And User can enter description
    And User can see save request button
    When User click on save request button
    Then Notification message will appear
  Scenario: Deny time off request
    And User can see time off requests table
    When User click on time off requests table row
    Then User can see deny time off request button
    When User click on deny time off request button
    Then Notification message will appear
  Scenario: Approve time off request
    And User can see approve time off request button
    When User click on approve time off request button
    Then User can see request button
    When User click on request button
    Then User can see eployee select
    When User click employee select
    Then User can see employee dropdown
    And User can select employee from dropdown options
    And User can see time off policy select
    When User click on time off policy select
    Then User can see time off policy dropdown again
    And User can select time off policy from dropdown options
    And User can see start date input field
    And User can enter start date
    And User can see end date input field
    And User can enter and date
    And User can see description input field
    And User can enter description
    And User can see save request button
    When User click on save request button
    Then Notification message will appear
  Scenario: Delete time off request
    And User can see time off requests table again
    When User click on time off requests table row again
    Then User can see delete time off request button
    When User click on delete time off request button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
  Scenario: Add holiday
    And User can see add holiday button
    When User click on add holiday button
    Then User can see holiday name select
    When User click on holiday select
    Then User can select holiday from dropdown options
    And User can see select employee dropdown
    When User click on selectn employee dropdown
    Then User can select employee from seelct dropdown options
    And User can see again time off policy dropdown
    When User click on time off policy dropdown
    Then User can see again time off polciy dropdown
    And User can select again time off policy from dropdown options
    And User can see start holiday input field
    And User can snter start holiday date
    And User can see end holiday date input field
    And User can enter end holiday date
    And User can see save holiday button
    When User click on save holiday button
    Then Notification message will appear