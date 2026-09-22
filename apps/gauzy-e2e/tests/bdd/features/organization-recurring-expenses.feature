Feature: Organization recurring expenses
  As a user of Ever Gauzy
  I want to manage organization recurring expenses
  So that I can track and maintain the organization's regular costs over time

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an organization recurring expense
    When I add a new organization recurring expense
    And I edit the organization recurring expense
    And I delete the organization recurring expense
