Feature: Manage candidates invites
  As a recruiter using Ever Gauzy
  I want to invite candidates and manage their invitations
  So that I can bring new candidates into the recruitment pipeline

  Background:
    Given I am logged in as the default user

  Scenario: Invite, resend and delete a candidate invite
    When I invite a candidate
    And I resend the candidate invite
    And I delete the candidate invite
