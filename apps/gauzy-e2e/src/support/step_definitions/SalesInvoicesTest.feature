Feature: Sales invoices test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add employee
    And User can add new employee
  Scenario: Add project
    And User can add new project
  Scenario: Add contact
    And User can add new contact
  Scenario: Add new invoice
    Then User can visit Invoices page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add Invoice button
    When User click on add Invoice button
    Then User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see discount input field
    And User can enter value for discount
    And User can see discount type dropdown
    When User click on discount type dropdown
    Then User can select discount type from dropdown options
    And User can see contact dropdown
    When User click on contact dropdown
    Then User can select contact from dropdown options
    And User can see tax input field
    And User can enter value for tax
    And User can see tax type dropdown
    When User click on tax type dropdown
    Then User can select tax type from dropdown options
    And User can see invoice type dropdown
    When User click on invoice type dropdown
    Then User can select invoice type from dropdown options
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see generate items button
    When User click on generate items button
    Then Save as draft button will become active
    When User click on Save as draft button
    Then Notification message will appear
    And User can verify invoice was created
  Scenario: Edit invoice
    Then User can select invoices first table row
    And Edit button will become active
    When User click on edit button
    Then User can see discount input field
    And User can enter value for discount
    And User can see discount type dropdown
    When User click on discount type dropdown
    Then User can select discount type from dropdown options
    And User can see contact dropdown
    When User click on contact dropdown
    Then User can select contact from dropdown options
    And User can see tax input field
    And User can enter value for tax
    And User can see tax type dropdown
    When User click on tax type dropdown
    Then User can select tax type from dropdown options
    Then Save as draft button will become active
    When User click on Save as draft button
    Then Notification message will appear
  Scenario: View invoice
    When User select invoices first table row
    Then View invoice button will become active
    And User can click on vew invoice button
    And User can see back button
    When User click on back button
  Scenario: Send invoice by email
    Then User can click again on invoices first table row
    And More settings button will become active
    When User click more settings button
    Then User can see email button
    When User click on email button
    Then User can scroll down to email input field
    And User can see email input field
    And User can enter value for email
    And User can see confirm send email button
    When User click on confirm send email button
    Then Notification message will appear
  Scenario: Verify invoice was sent
    Then User can see more settings button again
    And User can verify invoice was sent by email
  Scenario: Delete invoice
    Then User can click on invoices first row
    And Settings button will become active
    When User click settings button
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear