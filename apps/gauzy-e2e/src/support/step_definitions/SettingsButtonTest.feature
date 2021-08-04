Feature: Settings button test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Verify themes
    And User can see settings button
    When User click on settings button
    Then User can click on second dropdown
    And User can change language from dropdown options
    When User click on first dropdown
    Then User can verify Light theme
    Then User can verify Dark theme
    Then User can verify Cosmic theme
    Then User can verify Corporate theme
  Scenario: Verify languages
    When User click on second dropdown again
    Then User can verify English language
    And User can verify Bulgarian language
    And User can verify Hebrew language
    And User can verify Russian language
  Scenario: Verify layout
    When User click on third dropdown
    Then User can verify Grid layout
    And User can verify Table layout
    And User can see reset button