Feature: Invoices
  As a user of Ever Gauzy
  I want to manage invoices
  So that I can bill contacts and track each invoice through its lifecycle

  Background:
    Given I am logged in as the default user

  Scenario: Add, search, edit, send, view, email, set status and delete an invoice
    When I add a new invoice
    And I search for an invoice
    And I edit the invoice
    And I send the invoice
    And I view the invoice
    And I send the invoice by email
    And I set the invoice status
    And I delete the invoice
