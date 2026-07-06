Feature: Add user
  As an administrator of Ever Gauzy
  I want to add a new user
  So that people can access the organization with the right role

  Background:
    Given I am logged in as the default user

  Scenario: Add a new user
    When I add a new user
