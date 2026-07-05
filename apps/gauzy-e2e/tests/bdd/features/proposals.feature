Feature: Proposals
  As a user of Ever Gauzy
  I want to manage sales proposals
  So that I can register, track and progress job proposals for employees

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit, accept and delete a proposal
    When I add a new proposal
    And I edit the proposal
    And I mark the proposal as accepted
    And I delete the proposal
