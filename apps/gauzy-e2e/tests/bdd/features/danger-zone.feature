Feature: Danger Zone
  As a user of Ever Gauzy
  I want to review the danger zone account settings
  So that I can safely reach the delete-account controls without accidental data loss

  Background:
    Given I am logged in as the default user

  Scenario: Verify the danger zone delete-account controls
    When I verify the danger zone
