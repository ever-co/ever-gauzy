Feature: Roles Permissions test
  Scenario: Login with email
    Given Login with default credentials and visit Settings roles page
  Scenario: Super admin roles and permissions
    And User can see roles dropdown
    When User click on roles dropdown
    Then User can see roles dropdown options
    And User can select Super admin role from dropdown options
    And User can verify Super admin general roles and permissions
    And User can verify Super admin administration roles and permissions
  Scenario: Admin roles and permissions
    And User can see roles dropdown
    When User click on roles dropdown
    Then User can see roles dropdown options
    And User can select Admin role from dropdown options
    And User can verify Admin general roles and permissions
    And User can verify Admin administration roles and permissions
  Scenario: Data Entry roles and permissions
    And User can see roles dropdown
    When User click on roles dropdown
    Then User can see roles dropdown options
    And User can select Data Entry role from dropdown options
    And User can verify Data Entry general roles and permissions
    And User can verify Data Entry administration roles and permissions
  Scenario: Employee roles and permissions
    And User can see roles dropdown
    When User click on roles dropdown
    Then User can see roles dropdown options
    And User can select Employee role from dropdown options
    And User can verify Employee general roles and permissions
    And User can verify Employee administration roles and permissions
  Scenario: Candidate roles and permissions
    And User can see roles dropdown
    When User click on roles dropdown
    Then User can see roles dropdown options
    And User can select Candidate role from dropdown options
    And User can verify Candidate general roles and permissions
    And User can verify Candidate administration roles and permissions
  Scenario: Manager roles and permissions
    And User can see roles dropdown
    When User click on roles dropdown
    Then User can see roles dropdown options
    And User can select Manager role from dropdown options
    And User can verify Manager general roles and permissions
    And User can verify Manager administration roles and permissions
  Scenario: Viewer roles and permissions
    And User can see roles dropdown
    When User click on roles dropdown
    Then User can see roles dropdown options
    And User can select Viewer role from dropdown options
    And User can verify Viewer general roles and permissions
    And User can verify Viewer administration roles and permissions