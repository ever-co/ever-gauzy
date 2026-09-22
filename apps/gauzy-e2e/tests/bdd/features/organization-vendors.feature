Feature: Organization vendors
  As a user of Ever Gauzy
  I want to manage organization vendors
  So that I can maintain the suppliers my organization purchases from

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an organization vendor
    When I add a new vendor
    And I edit the vendor
    And I delete the vendor
