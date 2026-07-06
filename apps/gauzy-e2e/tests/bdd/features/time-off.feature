Feature: Time Off
  As a user of Ever Gauzy
  I want to manage employee time off requests, holidays and policies
  So that I can track, approve and organize leave across the organization

  Background:
    Given I am logged in as the default user

  Scenario: Manage time off requests, holidays and policies
    When I create a new time off request
    And I deny the time off request
    And I approve the time off request
    And I delete the time off request
    And I add a holiday
    And I add a new time off policy
