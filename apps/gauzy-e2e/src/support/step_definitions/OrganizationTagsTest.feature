Feature: Organization tags test
  Scenario: Login with email
    Given Login with default credentials and visit Organization tags page
  Scenario: Add tag
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add tag button
    When User click on add tag button
    Then User can see tag name input field
    And User can enter tag name
    And User can see color input field
    And User can enter value for color
    And User can see description input field
    And User can enter description text
    And User can see save tag button
    When User click on save tag button
    Then Notification message will appear
  Scenario: Edit tag
    And User can see tags table
    When User click on tags table row
    Then Edit tag button will become active
    When User click on edit tag button
    Then User can see tag name input field again
    And User can enter new tag name
    And User can see tag color input field again
    And User can enter new tag color
    And User can see tag description input field again
    And User can enter new description
    And User can see save edited tag button
    When User click on save edited tag button
    Then Notification message will appear
  Scenario: Filter tag 
    And User can see filter name input
    When User enter filter input field value
    Then User can see filtered tag
    And User clear input field value
  Scenario: Delete tag
    And User can see tags table again
    When User click on tags table row again
    Then Delete tag button will become active
    When User click on delete tag button
    Then User can see confirm delete tag button
    When User click on confirm delete tag button
    Then Notification message will appear