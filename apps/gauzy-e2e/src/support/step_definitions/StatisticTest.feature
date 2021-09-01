Feature: Statistics test
  Scenario: Login with email
    Given Login with default credentials and visit Candidates statistics page
  Scenario: Verify statistic page
    And User can verify text content
    When User click on first subheader
    Then user can verify text content
    When User click on second subheader
    Then user can verify text content
    When User click on third subheader
    Then user can verify text content
    When User click on fourth subheader
    Then user can verify text content