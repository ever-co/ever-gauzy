Feature: Income
  As a user of Ever Gauzy
  I want to manage income records
  So that I can track money received against employees, contacts and tags

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an income record
    When I add a new income
    And I edit the income
    And I delete the income
