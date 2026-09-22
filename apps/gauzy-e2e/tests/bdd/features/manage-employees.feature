Feature: Manage employees
  As a user of Ever Gauzy
  I want to manage employees and their invitations
  So that I can onboard, edit, offboard and remove people from my organization

  Background:
    Given I am logged in as the default user

  Scenario: Invite, add, edit, end work, delete an employee and manage the invite
    When I invite employees
    And I add a new employee
    And I edit the employee
    And I end the employee's work
    And I delete the employee
    And I copy the employee invite link
    And I resend the employee invite
    And I delete the employee invite
