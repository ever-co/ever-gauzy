Feature: Organization help center test
  Scenario: Login with email
    Given Login with default credentials and visit Organization help center page
  Scenario: Add base
    And User can see add button
    When User click on add button
    And User can see publish button
    When User click on publish  button
    Then User can see icon button
    When User click on icon button
    Then User can select first item from dropdown
    And User can see color input field
    And User can enter value for color
    And User can see name input field
    And User can enter name
    And User can see description input field
    And User can enter description
    And User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify base was created
  Scenario: Edit base
    And User can see settings button
    When User click on settings button
    Then User can see edit button
    When User click on edit button
    Then User can see color input field again
    And User can edit color
    And User can see name input field again
    And User can edit name
    And User can see description input field
    And User can edit description
    And User can see save edited base button
    When User click on save edited base button
    Then Notification message will appear
  Scenario: Delete base
    And User can see settings button again
    When User click on settings button again
    Then User can see delete base option
    When User click on delete base option
    Then User can see delete button
    When User click on delete button
    Then Notification message will appear