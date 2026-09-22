Feature: Invite Candidate
  As a recruiter in Ever Gauzy
  I want to invite, add and manage candidates
  So that I can track applicants through the recruitment pipeline

  Background:
    Given I am logged in as the default user

  Scenario: Invite, add, reject, edit and archive a candidate
    When I send a candidate invite
    And I add a new candidate
    And I reject the candidate
    And I edit the candidate
    And I archive the candidate
