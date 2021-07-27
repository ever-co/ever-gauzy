Feature: Organization inventory test
  Scenario: Login with email
    Given Login with default credentials and visit Organization inventory page
  Scenario: Add new product category
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add category button
    When User click on add category button
    And User can see add button
    When User click on add button
    Then User can see category name input field
    And User can enter value for category name
    And User can see category description input field
    And User can enter value for category description
    And User can see save category button
    When User click on save category button
    Then Notification message will appear
    And User can see back button
    When User click on back button
  Scenario: Add new product type
    Then User can click on add type button
    And User can see add product type button
    When User click on add product type button
    Then User can see type name input field
    And User can enter value for type name
    And User can see type category input field
    And User can enter value for type description
    And User can see save type button
    When User click on save type button
    Then Notification message will appear
    And User can see back button
    When User click on back button
  Scenario: Add new inventory
    Then User can see add inventory button
    When User click on add inventory button
    And User can see inventory name input field
    And User can add value for inventory name
    And User can se code input field
    And User can enter value for code
    And User can see product dropdown
    When User click on product dropdown
    Then User can select product from dropdown options
    And User can see category dropdown
    When User click on category dropdown
    Then User can select category from dropdown options
    And User can see inventory description input field
    And User can enter  value for inventory description
    And User can see save inventory button
    When User click on save inventory button
    Then Notification message will appear
    And User user can see back from inventory page button
    When User click back from inventory page button
    Then User can click on back button again
  Scenario: Edit inventory
    And User can see inventory table
    When User select inventory table row
    Then Edit inventory button will become active
    When User click on edit inventory button
    Then User can see editn inventory name input field
    And User can enter new inventory name
    And User can see edit code input field
    And User can enter new code
    And User can see edit description input field
    And User can enter new description
    And User can see save edited inventory button
    When User click on save edited inventory button
    Then Notification message will appear
    And User user can see back from inventory page button
    When User click back from inventory page button
  Scenario: Delete inventory
    Then User can see inventory table again
    When User select again inventory table row
    Then User can see delete inventory button
    When User click on delete inventory button
    Then User can see confirm delete inventory button
    When User click on confirm delete inventory button
    Then Notification message will appear
  Scenario: Edit product category
    And User can see add category button
    When User click on add category button
    Then User can see category table
    When User click on category table row
    Then Edit category button will become active
    When User click on edit category button
    Then User can see edit category name input field
    And User can enter new category name
    And User can see edit description input field
    And User can enter new category description
    And User can see save edited category button
    When User click on save edited category button
    Then Notification message will appear
  Scenario: Delete product category
    And User can see category table again
    When User click again on category table row
    Then Delete category button will become active
    When User click on delete category button
    Then User can see confirm delete category button
    When User click on confirm delete category button
    Then Notification message will appear
    And User can see back from category button
    When User click on back from category button
  Scenario: Edit product type
    Then User can see add product type button again
    When User click on add product type button again
    Then User can see product types table
    When User click on product types table row
    Then User can see edit product type button
    When User click on edit product type button
    Then User can see edit product type name input field
    And User can enter new product type name
    And User can see edit product type description input field
    And User can enter new product type description
    And User can see save edited product type button
    When User click on save edited product type button
    Then Notification message will appear
  Scenario: Delete product type
    And User can see again product types table
    When User click again on product types table row
    Then Delete product type button will become active
    When User click on delete product type button
    Then User can see confirm delete product type button
    When User click on confirm delete product type button
    Then Notification message will appear