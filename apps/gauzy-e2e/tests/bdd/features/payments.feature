Feature: Payments
  As a user of Ever Gauzy
  I want to record and manage accounting payments
  So that I can track amounts paid against projects with tags, methods and notes

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete a payment
    When I add a new payment
    And I edit the payment
    And I delete the payment
