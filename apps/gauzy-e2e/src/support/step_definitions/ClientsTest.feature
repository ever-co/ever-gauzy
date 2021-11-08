Feature: Clients test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    Then User can add new tag
  Scenario: Add project
    And User can add new project
  Scenario: Add new client
    And User can add new client
  Scenario: Invite client
    Then User can see invite button
    When User click on invite button
    Then User can see contact name input field
    And User can enter value for contact name
    And User can see client phone input field
    And User can enter value for client phone
    And User can see client email input field
    And User can enter value for client email
    And User can see save invite button
    When User click on save invite button
    Then Notification message will appear
    And User can verify client was created
  Scenario: Edit client
    When User see name input field
    Then User enter client name
    And User can verify client name
    And User can see clients table
    When User click on table first row
    Then Edit button will become active
    When User click on edit button
    Then User can see name input field
    And User can enter new value for name
    And User can see email input field
    And User can enter new value for email
    And User can see phone input field
    And User can enter new value for phone
    And User can see website input field
    And User can enter value for website
    And User can see save button
    When User click on save button
    Then User can see country dropdown
    When User click on country dropdown
    Then User can select country from dropdown options
    And User can see city input field
    And User can enter value for city
    And User can see post code input field
    And User can enter value for postcode
    And User can see street input field
    And User can enter value for street
    And User can see next button
    When User click on next button
    Then User can see hours input field
    And User can enter value for hours
    And User can see last step button
    When User click on last step button
    Then User can see next step button
    When User click on next step button
    Then Notification message will appear
    And User can verify client was edited
  Scenario: View client information
    And User can see clients table
    When User click on table first row
    Then View button will become active
    When User click on view button
    And User can verify client name in view
    And User can verify contact type
    Then User can see back button
    And User click on back button
  Scenario: Delete client
    When User see name input field again
    Then User enter client name again
    And User can see only selected user
    Then User can see clients table
    When User select table first row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
    And User can verify client was deleted