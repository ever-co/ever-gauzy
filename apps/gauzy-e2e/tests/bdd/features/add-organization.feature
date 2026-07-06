Feature: Create Organization
  As a user of Ever Gauzy
  I want to create a new organization
  So that I can manage its details, settings and locations in one place

  Background:
    Given I am logged in as the default user

  Scenario: Create a new organization
    When I create an organization
