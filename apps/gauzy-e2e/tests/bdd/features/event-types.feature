Feature: Event types
  As a user of Ever Gauzy
  I want to manage employee event types
  So that I can define reusable meeting slots with a title, description and duration

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an event type
    When I add a new event type
    And I edit the event type
    And I delete the event type
