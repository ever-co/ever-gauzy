Feature: Add employee level
  Scenario: Login with email test
    Given Visit home page as unauthorized user
    Then User can see login text
    And User cane see email input
    And Use can enter value for email
    And User cane see password input
    And Use can enter value for password
    When User click on login button
    Then User will see Create button
  Scenario: Add new tag
    When User go to Tags page
    Then User can see grid button on top right corner
    When User click on grid second grid button to change view
    Then User can see Add tag button
    When User click on Add tag button
    Then User will see tag name input
    And User can enter value for tag name
    And User can see tag color input
    And User can enter value for tag color
    And User can see tag description input
    And User can enter value for tag description
    And User can see save tag button
    And User can click on save tag button
  Scenario: Add new employee level
    When User visit Add new employee level page
    Then User can see grid button
    And User can click on second grid button to change view
    And User can see Add new level button
    When User click on Add new level button
    Then User will see new level input
    And User can enter new level name
    And User can see tags multi-select
    When User click on tags multi-select
    Then User can select tag from dropdown menu
    And User can see Save button
    When User click on Save button
    Then User will see notification message
    And User can see Edit level button
    When User click on Edit level button
    Then User can verify that new levelE was created
    And User can see cancel edit button
    And User can cancel editing by clicking on cancel button
  Scenario: Edit employee level
    And User can see edit level button
    When User click edit level button
    Then User can see level name input
    And User can enter new level name data
    And User can see tags multi-select
    When User click on tags multi-select
    Then User can select tag from dropdown menu
    And User can see Save button
    When User click on Save button
    Then User will see notification message
    And User can see Edit level button
    When User click on Edit level button
    Then User can verify that new levelF was created
    And User can see cancel edit button
    And User can cancel editing by clicking on cancel button
  Scenario: Delete employee level
    And User can see Add new level button again
    When User click on Add new level button again
    Then User will see new level input
    And User can enter another level name
    And User can see tags multi-select
    When User click on tags multi-select
    Then User can select tag from dropdown menu
    And User can see Save button
    When User click on Save button
    Then User will see notification message
    And User can see Delete level button
    When User click on Delete level button
    Then User will see Confirm delete button
    When User click on Confirm delete button
    Then User can verify that levelE was deleted
    And User will see notification message
    Then User can see Delete button again
    When User click on Delete button
    Then User can see Confirm delete button
    And User can click on Confirm delete button