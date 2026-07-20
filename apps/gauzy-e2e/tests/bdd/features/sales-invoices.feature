Feature: Sales Invoices
  As a user of Ever Gauzy
  I want to manage sales invoices
  So that I can bill contacts and track each sales invoice through its full lifecycle

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit, send, view, email, set status and delete a sales invoice
    When I add a new sales invoice
    And I edit the sales invoice
    And I send the sales invoice
    And I view the sales invoice
    And I send the sales invoice by email
    And I set the sales invoice status
    And I delete the sales invoice
