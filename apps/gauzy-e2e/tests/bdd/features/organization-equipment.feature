Feature: Organization equipment
  As a user of Ever Gauzy
  I want to manage organization equipment, sharing policies and sharing requests
  So that I can track shared assets and control how they are lent out

  Background:
    Given I am logged in as the default user

  Scenario: Manage organization equipment, policies and sharing requests
    When I add a new equipment
    And I add an equipment sharing policy
    And I request equipment sharing
    And I edit the equipment
    And I edit the equipment sharing request
    And I delete the equipment sharing request
    And I edit the equipment sharing policy
    And I delete the equipment sharing policy
