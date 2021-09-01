Feature: Pipelines test
  Scenario: Login with email
    Given Login with default credentials and visit Sales pipelines page
  Scenario: Add new pipeline
    And User can see grid button
    And User can click on second grid button to change view
    And User can see add pipeline button
    When User click on add pipeline button
    Then User can see name input field
    And User can enter pipeline name
    And User can see description input field
    And User can enter pipeline description
    And User can see create pipeline button
    When User click on create pipeline button
    Then Notification message will appear
  Scenario: Edit pipeline
    And User can see pipelines table
    When User click on pipelines table row
    Then User can see edit button
    When User click on edit button
    Then User can see name input field again
    And User can enter new pipeline name
    And User can see description input field again
    And User can enter new pipeline description
    And User can see update button
    When User click on update button
    Then Notification message will appear
  Scenario: Delete pipeline
    And User can see pipelines table again
    When User click on pipelines table row again
    Then User can see delete button
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear