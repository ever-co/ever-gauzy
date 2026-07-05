Feature: Organization documents
  As a user of Ever Gauzy
  I want to manage organization documents
  So that I can keep reference links and files organised for my organization

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete an organization document
    When I add a new document
    And I edit the document
    And I delete the document
