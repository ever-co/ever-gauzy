Feature: Organization vendors test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add new vendor
    And User can visit Organization vendors page
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add vendor button
    When User click on add vendor button
    Then User can see name input field
    And User can enter vendor name
    And User can see phone input field
    And User can enter vendor phone
    And User can see email input field
    And User can enter vendor email
    And User can see website input field
    And User can enter vendor website
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario:  Edit vendor
    And User can see edit button
    When User click on edit button
    Then User can see name input field again
    And User can change vendor name
    And User can see phone input field again
    And User can change vendor phone
    And User can see email input field again
    And User can change vendor email
    And User can see website input field again
    And User can change vendor website
    And User can see save button again
    When User click on save button again
    Then Notification message will appear
  Scenario: Delete vendor
    And User can see delete button
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear