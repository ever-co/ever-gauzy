Feature: Sales estimates test
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
  Scenario: Add new estimate
    Then User can visit Sales estimates page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add Estimate button
    When User click on add Estimate button
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
    And User can verify estimate was created
  Scenario: Search estimate
    And User can see tab button
    When User click on second tab button
    Then User can see estimate number input field
    And User can enter estimate number
    And User can see currency dropdown
    And User can see estimate date input field
    And User can see estimate due date input field
    And User can see total value input field
    And User can see status input field
    And User can see search button
    When User click on search button
    Then User can see reset button
    When User click on reset button
    Then User can click search button
    And User can verify badge
    And User can edit estimate number
    And User can click search button again
    And User can click on reset button
    And User can verify badge
    And User can click on next tab button
    And User can verify badge
  Scenario: Edit estimate
    When User click on first tab button
    Then User can select estimates first table row
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
  Scenario: View estimate
    When User select estimates first table row
    Then View estimate button will become active
    And User can click on vew estimate button
    And User can see back button
    When User click on back button
  Scenario: Send estimate by email
    Then User can click again on estimates first table row
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
  Scenario: Convert estimate to invoice
    Then User can click again on estimates first table row
    And User can see convert to invoice button
    And User can click on convert to invoice button
  Scenario: Delete estimate
    And User can see add Estimate button
    When User click on add Estimate button
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
    And User can verify badge
    Then User can click on estimates first row
    And Settings button will become active
    When User click settings button
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear