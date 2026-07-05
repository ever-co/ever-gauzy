Feature: Add Tasks
  As a user of Ever Gauzy
  I want to add, duplicate, edit and delete tasks
  So that I can track and manage the work assigned to my team

  Background:
    Given I am logged in as the default user

  Scenario: Add, duplicate, edit and delete a task
    When I add a new task
    And I duplicate the task
    And I edit the task
    And I delete the task
