Feature: Manage employees test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    And User can add new tag
  Scenario: Add project
    And User can add new project
  Scenario: Invite employees
    And User can visit Employees page
    And User can see grid button
    And User can click on grid button to change view
    And User can see invite button
    When User click on invite button
    Then User will see email input field
    And User can enter multiple emails
    And User can see date input field
    And User can enter value for date
    And User can see project dropdown
    When User click on project dropdown
    Then User can select project from dropdown options
    And User can see send invite button
    When User click on send invite button
    Then Notification message will appear
  Scenario: Add new employee
    And User can see add employee button
    When User click on add employee button
    Then User will see first name input field
    And User can enter value for first name
    And User will see last name input field
    And User can enter value for last name
    And User will see username input field
    And User can enter value for username
    And User can see employee email input field
    And User can enter value for employee email
    And User can see date input
    And User can enter date value
    And User can see password input field
    And User can enter value for password
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see image input field
    And User can enter value for image url
    And User can see next button
    When User click on next button
    Then User can see next step button
    When User click on next step button
    Then User will see last step button
    When User click on last step button
    Then Notification message will appear
  Scenario: Edit employee
    And User can see employees table
    When User click on emloyees table row
    Then Edit button will become active
    When User click on edit button
    Then User will see edit username input field
    And User can enter value for username edit
    And User can see edit email input field
    And User can enter value for email edit
    And User can see edit first name input field
    And User can enter value for first name edit
    And User can see edit last name input field
    And User can enter value for last name edit
    And User can see prefered language dropdown
    When User click on prefered language dropdown
    Then User can select language from dropdown options
    And User can see save edit button
    When User click on save edit button
    Then Notification message will appear
    And User can go back to Employees page
  Scenario: End employee work
    And User can see employees table again
    When User click on emloyees table row again
    Then End work button will become active
    When User click on end work button
    Then User will see confirm button
    When User click on confirm button
    Then Notification message will appear
  Scenario: Delete employee
    And User can see employees table again
    When User click over table row
    Then Delete button will become active
    When User click on delete button
    Then User will see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
  Scenario: Copy invite link
    And User can see manage invites button
    When User click on manage invites button
    Then User will see and select first row from invites table
    And User can see copy invite button
    When User click on copy invite button
    Then Notification message will appear
  Scenario: Resend invite
    When User select first table row again
    Then Resend invite button will become active
    When User click on resend invite button
    Then User will see confirm resend button
    When User click on confirm resend invite button
    Then Notification message will appear
  Scenario: Delete invite
    When User click on invites first table row
    Then Delete invite button will become active
    When User click on delete invite button
    Then User will see confirm delete invite button
    When User click on confirm delete invite button
    Then Notification message will appear