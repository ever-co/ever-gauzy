Feature: Integrations test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Verify dropdown text
    Then User can visit Integrations page
    And User can see All integrations dropdown
    When User click on All integrations dropdown
    Then User can verify All integrations dropdown options
    Then User can click on All dropdown
    And User can verify All dropdown options
  Scenario: Verify inputs
    And User can verify search input field
    And User can see clear search field button
    And User can see integrations list
    When User click on Hubstaff integration option
    Then User can verify card header
    And User can see client input field
    And User can see back button
    When User click on back button
    Then User will go back to integration list and can click on Upwork option
    And User can verify Upwork header
    And User can see api key input field
    And User can see secret input field