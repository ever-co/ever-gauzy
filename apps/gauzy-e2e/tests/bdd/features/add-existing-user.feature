Feature: Add existing user
  As a user of Ever Gauzy
  I want to add existing tenant users back into an organization
  So that I can manage who belongs to the organization without recreating accounts

  Background:
    Given I am logged in as the default user

  @skip
  Scenario: Remove and re-add an existing user to the organization
    When I add an existing user to the organization
