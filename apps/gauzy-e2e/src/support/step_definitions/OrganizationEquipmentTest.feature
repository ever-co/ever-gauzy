Feature: Organization equipment test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add new equipment
    And User can visit Organization equipment page
    And User can see grid button
    And User can click on grid button to change view
    And User can see add equipment button
    When User click on add equipment button
    Then User will see name input field
    And User can enter value for name
    And User can see type input field
    And User can enter value for type
    And User can see serial number input field
    And User can enter value for serial number
    And User can see manufactured year input field
    And User can enter value for manufactured year
    And User can see initial cost input field
    And User can enter value for initial cost
    And User can see share period input field
    And User can enter value for share period
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify equipment was created
  Scenario: Add equipment policy
    And User can see equipment sharing button
    When User click on equipment sharing button
    Then User can see sharing policy button
    When User click on sharing policy button
    Then User can see add policy button
    When User click on add policy button
    Then User can see policy name input field
    And User can enter policy name
    And User can see policy description input field
    And User can enter value for policy description
    And User can see save policy button
    When User click on save policy button
    Then Notification message will appear
    And User can verify policy was created
    And User can see back button
    When User click on back button
  Scenario: Request equipment sharing
    Then User can see request equipment sharing button
    When User click on request equipment sharing button
    Then User can see request name input field
    And User can enter value for request name
    And User can see equipment dropdown
    When User click on equipment dropdown
    Then User can select equipment from dropdown options
    And User can see policy dropdown
    When User click on policy dropdown
    Then User can select policy from dropdown options
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see date input field
    And User can enter value for date
    And User can see start date input field
    And User can enter value for start date
    And User can see end date input field
    And User can enter value for end date
    And User can see save request button
    When User click on save request button
    Then Notification message will appear
    And User can see back button
    When User click on back button
  Scenario: Edit equipment
    Then User can see equipment table
    When User click on equipment table row
    Then Edit button will become active
    When User click on edit button
    Then User can see edit name input field
    And User can enter new value for name
    And User can see save edited equipment button
    When User click on save edited equipment button
  Scenario: Edit equipment request
    Then User can see equipment sharing button again
    When User click on equipment sharing button again
    Then user can see equipment sharing table
    When User click on equipment sharing table row
    Then Edit equipment button will become active
    When User click on edit equipment button
    Then User can see edit request name input field
    And User can enter new value for request name
    And User can see save edited request button
    When User click on save edited request button
    Then Notification message will appear
  Scenario: Delete equipment request
    And User can see again equipment sharing table
    When User select equipment sharing table row
    Then Delete button will become active
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
  Scenario: Edit policy
    And User can see policy button
    When User click on policy button
    Then User can see policy table
    When User select policy table row
    Then Edit policy button will become active
    When User click on edit policy button
    And User can see edit policy name input field
    And User can enter new policy name
    And User can see edit policy description input field
    And User can enter new description
    And User can see save edited policy button
    When User click on save edited policy button
    Then Notification message will appear
  Scenario: Delete policy
    Then User can see policy table again
    When User select again policy table row
    Then Delete policy button will become active
    When User click on delete policy button
    Then User can see confirm delete policy button
    When User click on confirm delete policy button
    Then User will see notification message