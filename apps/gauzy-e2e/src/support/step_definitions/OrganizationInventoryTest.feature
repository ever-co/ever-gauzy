Feature: Organization inventory test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add new product category
    And User can visit Organization inventory page
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
    Then User can see edit inventory name input field
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
  Scenario: Add warehouse
    And User can see sidebar menu buttons
    When User click on Organization sidebar button
    Then User can click on Inventory sidebar button
    And User can see Warehouses button
    When User click on Warehouses button
    Then User can see Add warehouse button
    When User click on Add warehouse button
    Then User can see warehouse name input field
    And User can enter value for warehouse name
    And User can see warehouse tags select
    When User click on warehouse tags select
    Then User can select warehouse tag from dropdown options
    And User can see warehouse code input field
    And User can enter warehouse code
    And User can see warehouse email input field
    And User can enter value for warehouse email
    And User can see warehouse active state checkbox
    And User can click on warehouse active state checkbox
    And User can see warehouse description input field
    And User can enter value for merchant description
    And User can see tab button
    When User click on Location tab button
    Then User can see warehouse country select
    When User click on warehouse country select
    Then User can select warehouse country from dropdown options
    And User can see warehouse city input field
    And User can enter value for warehouse city
    And User can see warehouse postcode input field
    And User can enter value for warehouse postcode
    And User can see warehouse address input field
    And User can enter value for warehouse address
    And User can see save warehouse button
    When User click on save warehouse button
    Then Notification message will appear
    And User can verify Warehouse was created
  Scenario: Add merchant
    When User click again on Inventory sidebar menu button
    Then User can see Merchants button
    When User click on Merchants button
    Then User can see Add merchant button
    When User click on Add merchant button
    Then User can see merchant name input field
    And User can enter merchant name
    And User can see merchant code input field
    And User can enter merchant code
    And User can see merchant email input field
    And User can enter value for merchant email
    And User can see currency select
    When User click on currency select
    Then User can select currency from dropdown options
    And User can see merchant website input field
    And User can enter value for merchant website
    And User can see merchant tags select
    When User click on merchant tags select
    Then User can select merchant tag from dropdown options
    And User can see merchant description input field
    And User can enter value for merchant description
    And User can see merchant active state checkbox
    And User can click on merchant active state checkbox
    And User can see next step button
    When User click on next step button
    Then User can see merchant country select
    When User click on merchant country select
    Then User can select merchant country from dropdown options
    And User can see merchant city input field
    And User can enter value for merchant city
    And User can see merchant postcode input field
    And User can enter value for merchant postcode
    And User can see merchant address input field
    And User can enter value for merchant address
    And User can see last step button
    When User click on last step button
    And User can see warehouse select
    When User click on warehouses select
    Then User can select warehouse from dropdown options
    And User can see save merchant button
    When User click on save merchant button
    Then Notification message will appear
    And User can verify Merchant was created
  Scenario: Edit Merchant
    And User can see merchants table
    When User click on merchants table row
    Then Edit merchant button will become active
    When User click on edit merchant name
    Then User can see again merchant name input field
    And User can enter new value for merchant name
    And User can see again next step button
    When User click on next step button again
    Then User can click again on last step button
    And User can see again save merchant button
    When User click on save edited merchant button
    Then Notification message will appear
    And User can verify Merchant was edited
  Scenario: Delete merchant
    And User can see merchants table again
    When User click again on merchants table row
    Then Delete merchant button will become active
    When User click on delete merchant button
    Then User click on delete button to confirm
    Then Notification message will appear
  Scenario: Edit warehouse
    When User click on Inventory sidebar button again
    Then User can see Warehouses button again
    When User click on Warehouses button again
    Then User can see warehouses table
    When User click on warehouses table row
    Then Edit warehouse button will become active
    When User click on edit warehouse button
    Then User can see warehouse name input field again
    And User can enter new value for warehouse name
    And User can see save edited warehouse button
    When User click on save edited warehouse button
    Then Notification message will appear
    And User can verify warehouse was edited
  Scenario: Delete warehouse
    And User can see warehouses table again
    When User click on warehouses table row again
    Then Delete warehouse button will become active
    When User click on delete warehouse button
    Then User can see confirm delete warehouse button
    When User click on confirm delete warehouse button
    Then Notification message will appear