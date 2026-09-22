Feature: Goals
  As a user of Ever Gauzy
  I want to manage goals, key results, deadlines and weight parameters
  So that I can track objectives and their measurable outcomes

  Background:
    Given I am logged in as the default user

  Scenario: Manage a goal end to end
    When I add a new goal
    And I add a key result to the goal
    And I add a new deadline to the key result
    And I add a weight parameter to the key result
    And I edit the goal
    And I delete the goal
