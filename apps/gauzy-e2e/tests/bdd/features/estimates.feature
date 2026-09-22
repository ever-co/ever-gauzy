Feature: Estimates
  As a user of Ever Gauzy
  I want to manage estimates end to end
  So that I can quote, send, convert and track work for my contacts

  Background:
    Given I am logged in as the default user

  Scenario: Create, search, edit, duplicate, send, view, convert and delete an estimate
    When I add a new estimate
    And I search for an estimate
    And I edit the estimate
    And I duplicate the estimate
    And I send the estimate
    And I view the estimate
    And I send the estimate by email
    And I convert the estimate to an invoice
    And I delete the estimate
