Feature: Organization inventory
  As a user of Ever Gauzy
  I want to manage the organization inventory
  So that I can track products alongside their categories and types

  Background:
    Given I am logged in as the default user

  Scenario: Manage product categories, types and inventory items
    When I add a new product category
    And I add a new product type
    And I add a new inventory item
    And I edit the inventory item
    And I delete the inventory item
    And I edit the product category
    And I delete the product category
    And I edit the product type
    And I delete the product type
