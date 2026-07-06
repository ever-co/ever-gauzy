Feature: Organization departments
  As a user of Ever Gauzy
  I want to manage organization departments
  So that I can group employees into departments for my organization

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an organization department
    When I add a new department
    And I edit the department
    And I delete the department
