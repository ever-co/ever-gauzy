Feature: Roles and permissions
  As an administrator of Ever Gauzy
  I want to inspect each role's permission toggles
  So that I can confirm every role grants exactly the access it should

  Background:
    Given I am logged in as the default user

  Scenario: Inspect the permission toggles for every built-in role
    When I open the Roles and Permissions screen
    And I verify the super admin roles and permissions
    And I verify the admin roles and permissions
    And I verify the data entry roles and permissions
    And I verify the employee roles and permissions
    And I verify the candidate roles and permissions
    And I verify the manager roles and permissions
    And I verify the viewer roles and permissions
    And I verify the roles and permissions labels render
