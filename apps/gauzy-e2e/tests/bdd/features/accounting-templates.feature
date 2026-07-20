Feature: Accounting Templates
  As a user of Ever Gauzy
  I want to preview the accounting templates in a chosen language
  So that I can confirm invoices, estimates and receipts render correctly

  Background:
    Given I am logged in as the default user

  Scenario: Preview and verify the invoice, estimate and receipt accounting templates
    When I visit the accounting templates page and pick a language
    And I render and verify the invoice accounting template
    And I render and verify the estimate accounting template
    And I render and verify the receipt accounting template
