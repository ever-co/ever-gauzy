Feature: Timesheets
  As a user of Ever Gauzy
  I want to log, view, edit and delete employee time entries
  So that I can accurately track and manage worked time on timesheets

  Background:
    Given I am logged in as the default user

  Scenario: Add, view, edit and delete a timesheet time log
    When I add a timesheet time log
    And I view the timesheet time log
    And I edit the timesheet time log
    And I delete the timesheet time log
