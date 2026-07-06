Feature: Edit Employee
  As a user of Ever Gauzy
  I want to edit an employee's profile across every tab
  So that I can keep account, network, employment, hiring, location, rate, project and contact data accurate

  Background:
    Given I am logged in as the default user

  Scenario: Edit an employee across all profile tabs
    When I edit the employee account data
    And I edit the employee network data
    And I edit the employee employment data
    And I edit the employee hiring data
    And I edit the employee location data
    And I edit the employee rates data
    And I edit the employee projects data
    And I edit the employee contacts data
