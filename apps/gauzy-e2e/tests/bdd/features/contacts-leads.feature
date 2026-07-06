Feature: Contacts leads
  As a user of Ever Gauzy
  I want to manage contact leads
  So that I can capture, invite, update and remove prospective contacts

  Background:
    Given I am logged in as the default user

  Scenario: Add, invite, edit and delete a contact lead
    When I add a new lead
    And I invite the lead
    And I edit the lead
    And I delete the lead
