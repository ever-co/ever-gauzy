Feature: Settings button test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Verify themes
    And User can see settings button
    When User click on settings button
    Then User can click on first dropdown
    And User can verify Light theme
    And User can verify Dark theme
    And User can verify Cosmic theme
    And User can verify Corporate theme
  Scenario: Verify layout
    When User click on third dropdown
    Then User can verify Grid layout
    And User can verify Table layout
    And User can see reset button