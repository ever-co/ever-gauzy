Feature: Add Employee Position
  As a user of Ever Gauzy
  I want to manage employee positions
  So that I can define and maintain the roles employees can hold

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an employee position
    When I add a new employee position
    And I edit the employee position
    And I delete the employee position
