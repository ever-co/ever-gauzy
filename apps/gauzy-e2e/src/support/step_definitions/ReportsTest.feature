Feature: Reports test
  Scenario: Login with email
    Given Login with default credentials and visit Reports page
  Scenario: Verify Time tracking
    And User can verify Time tracking content
    And User can verify Time tracking settigns state
  Scenario: Payments tracking
    And User can verify Payments content
    And User can verify Payments settigns state
  Scenario: Time Off tracking
    And User can verify Time Off content
    And User can verify Time Off settigns state
  Scenario: Invoices tracking
    And User can verify Invoices content
    And User can verify Invoices settigns state