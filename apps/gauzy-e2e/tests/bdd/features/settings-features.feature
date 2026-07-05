Feature: Verify Settings Features
  As a user of Ever Gauzy
  I want to review the tenant feature-toggle settings
  So that I can confirm every platform feature is enabled by default

  Background:
    Given I am logged in as the default user

  Scenario: Verify the default-enabled state of every tenant feature toggle
    When I verify the Task Dashboard feature
    And I verify the Manage Payment and Create First Payment features
    And I verify the Manage Proposal and Register First Proposal features
    And I verify the Create First Expense feature
    And I verify the Manage Invoice and Create First Invoice features
    And I verify the Job Search and Jobs Matching feature
    And I verify the Manage Time Activity, Screenshots, App, Visited Sites and Activities feature
    And I verify the Employee Appointment, Schedules and Book Public Appointment feature
    And I verify the Manage Organization Details, Location and Settings features
    And I verify the Manage Project and Create First Project features
    And I verify the Manage Organization Document and Create First Document features
    And I verify the Manage Goals and Objectives feature
    And I verify the Manage Tenant Users feature
    And I verify the Manage Available Apps and Integrations feature
    And I verify the Manage Setting feature
    And I verify the Manage Tenant and Organization Custom SMTP feature
    And I verify the Download Desktop App and Create First Timesheet feature
    And I verify the Manage Estimate and Create First Estimate features
    And I verify the Create First Income feature
    And I verify the Manage Employee Statistics and Time Tracking Dashboard feature
    And I verify the Create Sales Pipeline feature
    And I verify the Manage Employees and Add or Invite Employees features
    And I verify the Manage Employee Timesheet feature
    And I verify the Manage Candidates, Interviews and Invites features
    And I verify the Manage Product Inventory and Create First Product features
    And I verify the Manage Organization Team and Create First Team features
    And I verify the Manage Leads, Customers and Clients feature
    And I verify the Manage Expense and Reports feature
    And I verify the Manage Tenant Organizations feature
    And I verify the Manage Email History feature
    And I verify the Manage Entity Import and Export feature
    And I verify the Manage Roles and Permissions feature
