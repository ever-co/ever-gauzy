Feature: Reports
  As a user of Ever Gauzy
  I want to browse the reports catalogue
  So that I can confirm every report category is listed and enabled for my organization

  Background:
    Given I am logged in as the default user

  Scenario: Verify the reports catalogue and its enabled toggles
    When I verify the time tracking reports
    And I verify the payments reports
    And I verify the time off reports
    And I verify the invoicing reports
