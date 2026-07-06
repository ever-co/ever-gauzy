Feature: Organization projects
  As a user of Ever Gauzy
  I want to manage organization projects
  So that I can plan, budget and track my organization's work

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an organization project
    When I add a new project
    And I edit the project
    And I delete the project
