Feature: Customers test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add tag
    Then User can add new tag
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add project
    And User can add new project
  Scenario: Add new customer
    And User can visit Contacts customers page
    Then User can see grid button
    And User can see grid second grid button to change view
    And User can see Add button
    When User click Add button
    Then User can see name input field
    And User can enter new value for name
    And User can see email input field
    And User can enter new value for email
    And User can see phone input field
    And User can enter new value for phone
    And User can see project dropdown
    When User click on project dropdown
    Then User can select project from dropdown options
    And User can see tags multyselect
    When User click on tags nultyselect
    Then User can select tags from dropdown options
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
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    Then User can see finish button
    When User click on finish button
    Then Notification message will appear
    And User can verify customer was edited
  Scenario: Invite customer
    Then User can see invite button
    When User click on invite button
    Then User can see customer name input field
    And User can enter value for customer name
    And User can see customer phone input field
    And User can enter value for customer phone
    And User can see customer email input field
    And User can enter value for customer email
    And User can see save invite button
    When User click on save invite button
    Then Notification message will appear
    And User can verify customer was created
  Scenario: Edit customer
    And User can see customers table
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
    And User can verify customer was edited
  Scenario: Delete customer
    Then User can see customers table
    When User select first table row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
    And User can verify customer was deleted