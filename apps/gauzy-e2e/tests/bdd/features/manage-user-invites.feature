Feature: Manage Invites
  As a user of Ever Gauzy
  I want to manage user invites
  So that I can copy, resend and delete invitations sent to team members

  Background:
    Given I am logged in as the default user

  Scenario: Copy, resend and delete a user invite
    When I copy an invite
    And I resend an invite
    And I delete an invite
