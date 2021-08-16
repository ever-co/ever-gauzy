Feature: Accounting templates test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Visit Accounting templates page
    And User can visit Accounting templates page
    And User can see save button
    And User can see language select
    When User click on language select
    Then user can see language dropdown options
    And User can select language from dropdown options
  Scenario: Invoice template
    And User can see templates select
    When User click on templates select
    Then User can see templates dropdown options
    And User can select Invoice dropdown option
    And User can verify main logo
    And User can verify invoice template header
    And User can verify sender column
    And User can verify receiver column
    And User can verify invoice number column
    And User can verify invoice date column
    And User can verify invoice due date column
  Scenario: Estimate template
    And User can see templates select
    When User click on templates select
    Then User can see templates dropdown options
    And User can select Estimate dropdown option
    And User can verify main logo
    And User can verify estimate template header
    And User can verify sender column
    And User can verify receiver column
    And User can verify estimate number column
    And User can verify estimate date column
    And User can verify estimate due date column
  Scenario: Receipt template
    And User can see templates select
    When User click on templates select
    Then User can see templates dropdown options
    And User can select Receipt dropdown option
    And User can verify main logo
    And User can verify receipt template header
    And User can verify bill to column
    And User can verify receipt number column
    And User can verify receipt payment date column
    And User can verify receipt payment method column