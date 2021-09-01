Feature: Add employee position
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new tag
    Then User can add new tag
  Scenario: Add new employee position
    Then User can go to Employee positions page
    And User will see grid button
    And User can click on second grid button to change view
    And User can see Add new position button
    When User click on Add new position button
    Then User can see new position input
    And User can add data for new position
    And User can see tag multiselect
    When User click on tag multiselect
    Then User can pick tag from dropdown menu
    And User can see save position button
    When User click on save position button
    Then Notification message will appear
    And User can see edit position button
    When User click on edit position button
    Then User can verify position was created
    And User can see cancel edit button
    And User can click on cancel edit button
  Scenario: Еdit employee position
    Then User can see edit newly position button
    When User click on edit new position button
    Then User can edit previously created position
    And User can see tag multiselect
    When User click on tag multiselect
    Then User can pick tag from dropdown menu
    And User can see save position button
    When User click on save position button
    Then Notification message will appear
    And User can see edit position button
    When User click on edit position button
    Then User can verify position was edited
    And User can see cancel edit button
    And User can click on cancel edit button
  Scenario: Delete employee position
    And User can see Add new position button
    When User click on Add new position button
    Then User can see new position input
    And User can add data for new position
    And User can see tag multiselect
    When User click on tag multiselect
    Then User can pick tag from dropdown menu
    And User can see save position button
    When User click on save position button
    Then Notification message will appear
    And User can see delete position button
    When User click on delete position button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then User can verify that position was deleted
    And User will see a notification message
    And User can see delete position button
    When User click on delete position button
    Then User can see confirm delete button
    And User click on confirm delete button