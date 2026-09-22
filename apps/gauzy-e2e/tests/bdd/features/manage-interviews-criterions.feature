Feature: Manage Interviews Criterions
  As a user of Ever Gauzy
  I want to manage interview criterions
  So that I can define the technology stacks and personal qualities candidates are assessed against

  Background:
    Given I am logged in as the default user

  Scenario: Manage interviews criterions
    When I add a technology stack criterion
    And I edit the technology stack criterion
    And I delete the technology stack criterion
    And I add a personal quality criterion
    And I edit the personal quality criterion
    And I delete the personal quality criterion
