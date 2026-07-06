Feature: Clients
  As a user of Ever Gauzy
  I want to manage clients
  So that I can add, invite, edit and remove the contacts I do business with

  Background:
    Given I am logged in as the default user

  Scenario: Add, invite, edit and delete a client
    When I add a new client
    And I invite a client
    And I edit the client
    And I delete the client
