Feature: Add teams tasks
  As a user of Ever Gauzy
  I want to manage a team's tasks
  So that I can create, duplicate, edit and delete work items assigned to a team

  Background:
    Given I am logged in as the default user

  Scenario: Add, duplicate, delete, edit and remove a team task
    When I add a new team task
    And I duplicate the team task
    And I delete the duplicated team task
    And I edit the team task
    And I delete the edited team task
