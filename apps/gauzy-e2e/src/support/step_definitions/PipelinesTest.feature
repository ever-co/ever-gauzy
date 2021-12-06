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
    When User see stage add button
    Then User click on stage button
    When User see name input field
    Then User enter stage name
    And User can see create pipeline button
    When User click on create pipeline button
    Then Notification message will appear
  Scenario: Edit pipeline
    When User see name input field search by first name
    Then User can enter name first name
    And User can see only the result
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
  Scenario: Add pipeline deals
    When User see name input field search
    Then User can enter name
    And User can see only the result
    And User can see pipelines table
    When User click on pipelines table row
    When User see view details button
    Then User can click view details button
    And User can see add pipeline button again
    When User click on add pipeline button again
    Then User can see title input field
    And User enter title
    Then User can see probability input
    And User click on probability input
    And User click on option from dropdown
    Then User can see create button
    And User click on create button
    Then Notification message will appear
    Then User redirect to pipelines page
  Scenario: Delete pipeline
    When User see name input field search
    Then User can enter name
    And User can see only the result
    And User can see pipelines table again
    When User click on pipelines table row again
    Then User can see delete button
    When User click on delete button
    Then User can see confirm delete button
    When User click on confirm delete button
    Then Notification message will appear