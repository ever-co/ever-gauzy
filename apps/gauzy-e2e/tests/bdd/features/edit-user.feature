Feature: Edit User
  As an administrator of Ever Gauzy
  I want to add a user and then edit that user's details
  So that I can keep team member accounts accurate and up to date

  Background:
    Given I am logged in as the default user

  Scenario: Add a new user and edit that user
    When I add a user to edit
    And I edit the user
