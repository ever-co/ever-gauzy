Feature: Expenses test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add project
    And User can add new project
  Scenario: Add new expense
    When User visit Expenses page
    Then User can see grid button
    And User can click on second grid button to change view
    And User can see add expense button
    When User click on add expense button
    Then User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see category input field
    When User click on category input field
    Then User can enter category data
    And User can see date input field
    And User can enter value for date
    And User can see vendor input field
    When User click on vendor input field
    Then User can enter value for vendor
    And User can see amount input field
    And User can enter value for amount
    And User can see purpose input field
    And User can enter value for purpose
    And User can see project dropdown
    When User click on project dropdown
    Then User can select project from dropdown options
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify expense
  Scenario: Verify expense reports
    And User can see Reports sidebar button
    When User click on Reports sidebar button
    Then User can click on Expense sidebar button
    And User can see Group by select
    When User click on Group by select
    Then User can see option for Date
    And User can see option for Client
    And User can see option for Project
    When User click on Date dropdown option
    Then User can verify project
    And User can verify amount
    When User click again on Reports sidebar button
    Then User can click on Accounting sidebar button
    When User click on Expenses sidebar button
  Scenario: Edit expense
    When User select first table row
    Then Edit button will become active
    When User click on edit button
    Then User can see date input field
    And User can enter value for date
    And User can see purpose input field
    And User can enter value for purpose
    And User can see project dropdown
    When User click on project dropdown
    Then User can select project from dropdown options
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify expense
  Scenario: Duplicate expense
    When User select first table row
    Then Duplicate button will become active
    When User click on duplicate button
    Then User can see save button
    When User click on save button
    Then Notification message will appear
  Scenario: Delete expense
    When User select first table row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User can click on confirm delete button
    Then Notification message will appear
    When User select first table row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User can click on confirm delete button
    Then Notification message will appear
  Scenario: Add new category
    And User can see manage categories button
    When User click on manage categories button
    Then User can add category button
    When User click on add category button
    Then User can see new category input field
    And User can enter data for new category
    And User can see category tags dropdown
    When User click on category tags dropdown
    Then User can select category tag from dropdown options
    And User can see save category button
    When User click on save category button
    Then User can verify category was created