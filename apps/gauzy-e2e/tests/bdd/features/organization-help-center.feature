Feature: Organization help center
  As a user of Ever Gauzy
  I want to manage help center knowledge bases
  So that I can organize and publish support content for my organization

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete a help center base
    When I add a help center base
    And I edit the help center base
    And I delete the help center base
