Feature: Goals KPI
  As a user of Ever Gauzy
  I want to manage goal KPIs
  So that I can track measurable targets against employees

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete a goal KPI
    When I add a new KPI
    And I edit the KPI
    And I delete the KPI
