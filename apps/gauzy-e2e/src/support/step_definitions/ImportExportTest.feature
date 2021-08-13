Feature: Import Export test
  Scenario: Login with email
    Given Login with default credentials and visit Settings Import Export page
  Scenario: Verify content
    And User can verify header
    And User can verify subheader
    And User can verify Import text
    And User can verify Export text
    And User can verify Download text
    And User can verify Import button
    And User can verify Export button
  Scenario: Verify migrate button works
    And User can see migrate button
    When User click on migrate button
    Then User can see password input field
    And User can enter value for password
    And User can see ok button
    And User can see cancel button
    When User click on cancel button
    Then User can see again import button
  Scenario: Upload file
    When User click on import button
    Then User can see browse files button
    When User attach file by clicking on browse file button
    Then User can see import file button
    When User click on import file button
    Then User can verify file was uplaoded by file name
    And User can verify file was uploaded by badge status
  Scenario: Remove file
    And User can see remove file button
    When User click on remove file button
    Then User can see again browse files button