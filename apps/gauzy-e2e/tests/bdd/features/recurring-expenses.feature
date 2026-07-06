Feature: Recurring expenses
  As a user of Ever Gauzy
  I want to manage employee recurring expenses
  So that I can track fixed costs that repeat over time

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete a recurring expense
    When I add a new recurring expense
    And I edit the recurring expense
    And I delete the recurring expense
