Feature: Apps integrations page
  As a user of Ever Gauzy
  I want to browse the apps and integrations catalogue
  So that I can find and configure integrations for my organization

  Background:
    Given I am logged in as the default user

  Scenario: Browse the apps integrations catalogue
    When I verify the apps integrations dropdown text
    And I verify the apps integrations inputs
