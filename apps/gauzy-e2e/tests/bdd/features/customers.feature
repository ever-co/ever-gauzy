Feature: Customers
  As a user of Ever Gauzy
  I want to manage customers
  So that I can track the clients my organization works with

  Background:
    Given I am logged in as the default user

  Scenario: Add, invite, edit and delete a customer
    When I add a new customer
    And I invite a customer
    And I edit the customer
    And I delete the customer
