Feature: Approval request test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add approval policy
    Then User can visit Employees approvals page
    And User can see Approval policy button
    When User click on Approval policy button
    Then User can see grid button
    And User cn click on second grid button to change view
    And User can see Add approval button
    When User click on Add approval buton
    Then User can see name input field
    And User can enter value for name
    And User can see description input field
    And User can enter value for description
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify policy was created
    And User can see back button
    When User click on back button
  Scenario: Add new approval request
    Then User can see grid button
    And User can click on second grid button to change view
    And User can see Add button
    When User click on Add button
    Then User can see approval name input field
    And User can enter value for approval name
    And User can see min count input field
    And User can enter value for min count
    And User can see approval policy dropdown
    When User click on approval policy dropdown
    Then User can select policy from dropdown options
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see save approval button
    When User click on save approval button
    Then Notification message will appear
    And User can verify request was created
  Scenario: Approve approval request
    When User see name input field
    Then User can search approval by name
    When User can see approval button
    Then User click on approval button
    Then Notification message will appear
    And User cant see approval button
    And User can see status is Approved
  Scenario: Refuse approval request
    When User see refuse button
    Then User click on refuse button
    Then Notification message will appear
    And User can see status is Refused
  Scenario: Edit approval request
    When User can select first table row
    Then Edit request button will become active
    When User click on edit approval request button
    Then User can see name input field
    And User can enter new value for name
    And User can see min count input field
    And User can enter new value for min count
    And User can see tags dropdown
    When User click on tags dropdown
    Then User can select tag from dropdown options
    When User click on card body
    Then User can see save button
    When User click on save button
    Then Notification message will appear
    When User see name input field again
    Then User can search approval by name again
    And User can verify request was edited
  Scenario: Delete approval request
    When User select first table row
    Then Delete request button will become active
    When User click on delete request button
    Then Notification message will appear
    And User clear search field
    And User can verify request was deleted