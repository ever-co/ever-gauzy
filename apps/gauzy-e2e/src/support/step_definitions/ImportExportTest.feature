Feature: Import Export test
  Scenario: Login with email
    Given Login with default credentials and visit Settings Import Export page
  Scenario: Import/Export Test
    And User can verify header
    And User can verify subheader
    And User can verify Import text
    And User can verify Export text
    And User can verify Download text
    And User can verify Import button
    And User can verify Export button
    And User can verify Download button