Feature: Sales estimates
  As a user of Ever Gauzy
  I want to manage sales estimates
  So that I can create, send, convert and track quotes for my contacts

  Background:
    Given I am logged in as the default user

  Scenario: Create, edit, duplicate, send, view, email, convert and delete a sales estimate
    When I add a new sales estimate
    And I edit the sales estimate
    And I duplicate the sales estimate
    And I send the sales estimate
    And I view the sales estimate
    And I send the sales estimate by email
    And I convert the sales estimate to an invoice
    And I delete the sales estimate
