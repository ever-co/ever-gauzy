Feature: Remove user
  As a user of Ever Gauzy
  I want to remove a user from the organization
  So that I can revoke access for people who no longer belong

  Background:
    Given I am logged in as the default user

  Scenario: Add a user and then remove it
    When I add a user to remove
    And I remove the user
