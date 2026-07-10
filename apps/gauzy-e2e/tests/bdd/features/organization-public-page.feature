Feature: Organization public page
  As a user of Ever Gauzy
  I want to publish and edit an organization public profile page
  So that clients can view an organization's details, awards and languages on a shareable link

  Background:
    Given I am logged in as the default user

  Scenario: Publish and edit an organization public page
    When I add a new organization
    And I add a new employee to the organization
    And I add a new project to the organization
    And I add a new client to the organization
    And I add a public profile link to the organization
    And I edit the organization public page
    And I verify the organization public page data
