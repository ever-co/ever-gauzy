Feature: Organization documents test
  Scenario: Login with email
    Given Login with default credentials and go to Organization documents page
  Scenario: Add new document
    And User can see grid button
    And User can click on grid button to change view
    And User can see add new document button
    When User click on add new document button
    Then User can see name input field
    And User can enter value for name
    And User can see url input field
    And User can enter value for url
    And User can see save document button
    When User click on save document button
    Then Notification message will appear
    And User can verify document was created
  Scenario: Edit document
    And User can see edit button
    When User click on edit button
    Then User can see edit name input field
    And User can enter new value for name
    And User can see save document button again
    When User click on save document button again
    Then Notification message will appear
    And User can verify document was edited
  Scenario: Delete document
    And User can see delete button
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear
    And User can verify document was deleted