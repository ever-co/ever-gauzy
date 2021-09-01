Feature: File storage test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add S3 file provider
    And User can visit File storage page
    And User can verify File storage page
    Then User can see provider dropdown
    When User click provider dropdown
    Then User can select provider from dropdown options
    And User can see access key input field
    And User can enter value for access key
    And User can see secret key input field
    And User can enter value for secret key
    And User can see region input field
    And User can enter value for region
    And User can see bucket input field
    And User can enter value for bucket
    And User can see save button
    When User click on save button
    Then Notification message will appear