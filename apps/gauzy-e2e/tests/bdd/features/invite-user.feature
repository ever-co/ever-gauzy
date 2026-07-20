Feature: Invite user/s
  As an administrator of Ever Gauzy
  I want to invite one or more users by email
  So that they can join the organization with an assigned role

  Background:
    Given I am logged in as the default user

  Scenario: Send an invitation to users
    When I send a user invite
