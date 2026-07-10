Feature: Goals Time Frame
  As a user of Ever Gauzy
  I want to manage goal time frames
  So that I can bound my organization's goals within defined start and end periods

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete a goal time frame
    When I add a new goal time frame
    And I edit the goal time frame
    And I delete the goal time frame
