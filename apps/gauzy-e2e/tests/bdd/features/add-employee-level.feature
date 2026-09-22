Feature: Add employee level
  As a user of Ever Gauzy
  I want to manage employee levels
  So that I can classify employees by seniority with reusable, tagged levels

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an employee level
    When I add a new employee level
    And I edit the employee level
    And I delete the employee level
