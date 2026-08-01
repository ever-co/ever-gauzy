Feature: Organization public page
  As a user of Ever Gauzy
  I want to publish and edit an organization public profile page
  So that clients can view an organization's details, awards and languages on a shareable link

  Background:
    Given I am logged in as the default user

  # This one scenario chains SEVEN end-to-end flows (create an organization through the 4-step stepper,
  # add an employee, a project and a client to it, publish a profile link, then edit and read back the
  # public share page). Measured end to end it runs ~250-300s, over the suite-wide 240s budget, and the
  # budget is not the thing under test here. Give this scenario its own budget instead of raising the
  # global one — every other spec keeps the tighter default.
  @timeout:420_000
  Scenario: Publish and edit an organization public page
    When I add a new organization
    And I add a new employee to the organization
    And I add a new project to the organization
    And I add a new client to the organization
    And I add a public profile link to the organization
    And I edit the organization public page
    And I verify the organization public page data
