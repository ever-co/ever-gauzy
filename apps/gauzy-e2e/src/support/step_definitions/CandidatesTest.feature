Feature: Employee candidates test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Send invite
    Then User can visit Employees candidates page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see invite button
    When User click on invite button
    Then User can see email input field
    And User can enter value for email
    And User can see invite date input field
    And User can enter value for invite date
    And User can see send invite button
    When User click on send invite button
  Scenario: Add new candidate
    Then User can see add candidate button
    When User click on add candidate button
    Then User can see first name input field
    And User can enter value for first name
    And User can see last name input field
    And User can enter value for last name
    And User can see username input field
    And User can enter value for username
    And User can see candidate email input field
    And User can enter candidate email value
    And User can see password inpit field
    And User can enter value for password
    And User can see candidate date input field
    And User can enter value for candidate date
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see image input field
    And User can enter value for image
    Then User can see next step button
    When User click on next step button
    Then User can see next button
    When User can click on next button
    Then User can see last step button
    When User click on last step button
    Then Notification message will appear
    And User can verify candidate
  Scenario: Reject candidate
    When User select first table row
    Then Reject button will become active
    When User click on reject button
    Then User can see confirm reject button
    When User click on confirm reject button
    Then Notification message will appear
    And User can verify badge
  Scenario: Edit candidate
    When User select first table row
    Then Edit button will become active
    When User click on edit button
    Then User can see save edit button
    When User click on save edit button
    Then User can see go back button
    When User can click on go back button
  Scenario: Archive candidate
    Then User can select first table row again
    And Archive button will become active
    When User click on archive button
    Then User will see confirm archive button
    When User click on confirm archive button
    Then Notification message will appear
    And User can verify candidate was archived