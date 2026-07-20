Feature: Delete Organization
  As a user of Ever Gauzy
  I want to delete an organization
  So that I can remove organizations that are no longer needed

  Background:
    Given I am logged in as the default user

  Scenario: Delete an organization
    When I delete an organization
