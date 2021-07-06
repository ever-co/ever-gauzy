Feature: Edit profile test
  Scenario: Login with email
    Given Login with default credentials
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
  Scenario: Logout
    When User click on username
    Then User can see and click on logout button
    And User can see again login text
  Scenario: Login with new credentials
    And User can enter value for login email
    And User can see login password input field
    When User click on login button
    Then User can see home page
    And User can visit his profile page
  Scenario: Edit user profile
    And User can see first name input field
    And User can enter value for first name
    And User can see last name input field
    And User can enter value for last name
    And User can see password input field
    And User can enter value for password
    And User can see repeat password input field
    And User can enter value for repeat password
    And User can see email input field
    And User can enter value for email
    And User can see language select
    And User can select language
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User cane verify that his data was edited