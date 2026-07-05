Feature: Expenses
  As a user of Ever Gauzy
  I want to manage expenses
  So that I can record, edit, duplicate, delete and categorise my organisation's spending

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit, duplicate, delete an expense and add a category
    When I add a new expense
    And I edit the expense
    And I duplicate the expense
    And I delete the expense
    And I add a new expense category
