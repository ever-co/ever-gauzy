Feature: Candidates invites test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Create new invite
    Then User can visit Candidates invites page
    Then User can see header of the page
    When User see invite button
    Then User click on invite button
    And User can see email input field
    And User can enter value for email
    And User can see date input field
    And User can enter value for date
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify invite was created
  Scenario: Search by Email
    When User see email input field
    Then User can enter email in email field
    And User can see only selected user
  Scenario: Resend invite
    And User can see invites table
    When User click on table row
    Then Resend invite button will become active
    When User click on resend invite button
    Then User will see confirm button
    When User click on confirm button
    Then Notification message will appear
  Scenario: Delete invite
    And User can see invites table
    When User click on table row
    Then Delete invite button will become active
    When User click on delete button
    Then User will see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
    Then User clear field
    And User verify invite is deleted
