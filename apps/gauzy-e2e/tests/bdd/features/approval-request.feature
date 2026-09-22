Feature: Approval Request
  As a user of Ever Gauzy
  I want to manage approval policies and approval requests
  So that I can route and track approvals for my organization

  Background:
    Given I am logged in as the default user

  Scenario: Add a policy, then create, edit and delete an approval request
    When I add an approval policy
    And I add a new approval request
    And I edit the approval request
    And I delete the approval request
