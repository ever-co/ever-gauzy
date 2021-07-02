Feature: Contacts test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    Then User can add new tag
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add project
    And User can add new project
  Scenario: Add lead
    And User can add new contact
    Then Notification message will appear
  Scenario: Invite lead
    Then User can see invite button
    When User click on invite button
    Then User can see contact name input field
    And User can enter value for contact name
    And User can see contact phone input field
    And User can enter value for contact phone
    And User can see contact email input field
    And User can enter value for contact email
    And User can see save invite button
    When User click on save invite button
    Then Notification message will appear
    And User can verify contact was created
  Scenario: Edit lead
    And User can see contacts table
    When User select first table row
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
    Then User can see finish button
    When User click on finish button
    Then Notification message will appear
    And User can verify contact was edited
  Scenario: Delete lead
    Then User can see contacts table
    When User select first table row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
    And User can verify contact was deleted