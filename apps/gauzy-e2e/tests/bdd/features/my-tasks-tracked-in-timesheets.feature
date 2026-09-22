Feature: My tasks tracked in timesheets
  As an employee of Ever Gauzy
  I want the tasks I create in My Tasks to be timed and recorded
  So that the work I do shows up on my timesheet

  Background:
    Given I am logged in as the default user

  Scenario: An employee times a My Tasks task and sees it on the timesheet
    When I add a new tag as admin for the timesheet flow
    And I add a new employee for the timesheet flow
    And I add a new project assigned to the timesheet employee
    And I log out as admin from the timesheet flow
    And I log in as the timesheet employee
    And I create a task from My Tasks as the employee
    And I record time against the new My Tasks task
    And I stop the timer and view the My Tasks timesheet
