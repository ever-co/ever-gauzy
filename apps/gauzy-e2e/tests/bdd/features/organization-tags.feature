Feature: Organization tags
  As a user of Ever Gauzy
  I want to manage organization tags
  So that I can categorize records with reusable, colour-coded labels

  Background:
    Given I am logged in as the default user

  Scenario: Create, edit and delete an organization tag
    When I create a new tag
    And I edit the tag
    And I delete the tag
