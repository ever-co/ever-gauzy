Feature: Add remove existing user
  Scenario: Login with email
    Given Login with default credentials and visit Users page
  Scenario: Add new user
    Then User can see Add new user button
    When User click on Add new user button
    Then User can see first name input field
    And User can enter value for first name
    And User can see last name input field
    And User can enter value for last name
    And User can see username input field
    And User can enter value for username
    And User can see email input field
    And User can enter value for email
    And User can see role select
    And User can set a role from dropdown options
    And User can see password input field
    And User can enter value for password
    And User can see image input field
    And User can enter url for image
    And User can see confirm button
    When User click on confirm button
    Then User creation will be confirmed with notification message
    And Users table will be populated with new user
  Scenario: Remove existing user
    Then User can see add existing usr button
    When User click add existing user button
    Then User can see cancel button
    And User can click on cancel button
    And User can verify users table exist
    When User click on table row
    Then Remove user button will became active
    When User click on remove user button
    Then User can see confirm remove user button
    And User can click on cofnrim remove user button