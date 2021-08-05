Feature: Create button test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Verify create button options
    And User can see create button
    When User click on create button
    Then User can verify all dropdown options
  Scenario: Verify income card
    When User click on income dropdown option
    Then User can see income card
    And User can se close button
    When User click on close button
    Then User can see create button again
    When User click on create button
  Scenario: Verify expense card
    Then User can select expense from dropdown options
    And User can see expense card
    And User can se close button
    When User click on close button
    Then User can see create button again
    When User click on create button
  Scenario: Verify invoice card
    Then User can select invoice from dropdown options
    And User can see invoice card
    And User can see create button again
    When User click on create button
  Scenario: Verify estimate card
    Then User can select estimate from dropdown options
    And User can see estimate card
    And User can see create button again
    When User click on create button
  Scenario: Verify payment card
    Then User can select payment from dropdown options
    And User can see payment card
    And User can see cancel button
    When User click on cancel button
    Then User can see create button again
    When User click on create button
  Scenario: Verify time log card
    Then User can select time log from dropdown options
    And User can see time log card
    And User can se close button
    When User click on close button
    Then User can see create button again
    When User click on create button
  Scenario: Verify candidate card
    Then User can select candidate dropdown options
    And User can see candidate card
    And User can se close button
    When User click on close button
    Then User can see create button again
    When User click on create button
  Scenario: Verify proposal card
    Then User can select proposal from dropdown options
    And User can see proposal card
    And User can see create button again
    When User click on create button
  Scenario: Verify contract card
    Then User can select contract from dropdown options
    And User can see contract card
    And User can see create button again
    When User click on create button
  Scenario: Verify team card
    Then User can select team from dropdown options
    And User can see team card
    And User can see create button again
    When User click on create button
  Scenario: Verify task card
    Then User can select task dropdown options
    And User can see task card
    And User can se close button
    When User click on close button
    Then User can see create button again
    When User click on create button
  Scenario: Verify contact card
    Then User can select contact from dropdown options
    And User can see contact card
    And User can see create button again
    When User click on create button
  Scenario: Verify project card
    Then User can select project from dropdown options
    And User can see project card
    And User can see create button again
    When User click on create button
  Scenario: Verify employee card
    Then User can select employee dropdown options
    And User can see employee card
    And User can se close button
    When User click on close button
    Then User can see create button again