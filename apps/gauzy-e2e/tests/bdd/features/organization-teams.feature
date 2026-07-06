Feature: Organization teams
  As a user of Ever Gauzy
  I want to manage organization teams
  So that I can group employees and managers into named teams

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an organization team
    When I add a new team
    And I edit the team
    And I delete the team
