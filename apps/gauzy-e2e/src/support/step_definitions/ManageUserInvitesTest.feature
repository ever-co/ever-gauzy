Feature: manage user invites test
  Scenario: Login with email
    Given Login with default credentials and visit Users page
  Scenario: Copy invite
    Then User can see manage invites button
    When User click on manage invites button
    Then User will see grid button
    And User can click on second grid button to change view
    And User can see invites table
    When User click on invites first table row
    Then Copy invite button will become active
    When User click on copy invite button
    Then Notification message will appear
  Scenario: Resend invite
    When User click on invites first table row again
    Then Resend invite button will become active
    When User click on resend invite button
    Then User can see confirm resend invite button
    When User click on confirm resend invite button
    Then Notification message will appear
  Scenario: Delete invite
    When User click again on first table row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear