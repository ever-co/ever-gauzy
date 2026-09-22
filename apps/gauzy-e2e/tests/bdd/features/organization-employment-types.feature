Feature: Organization employment types
  As a user of Ever Gauzy
  I want to manage organization employment types
  So that I can classify employees by the terms under which they work

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an organization employment type
    When I add a new employment type
    And I edit the employment type
    And I delete the employment type
