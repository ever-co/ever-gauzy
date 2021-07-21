Feature: Manage interviews criterion test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add technology stack
    And User can visit Candidates interview criterion page
    And User can see technology stack input field
    And User can enter value for technology stack
    And User can see save technology stack button
    When User click on save technology stack button
    Then Notification message will appear
    And User can verify technology stack
  Scenario: Edit technology stack
    And User can see edit technology stack button
    When User click on edit technology stack button
    Then User can see edit technology stack input field
    And User can enter new value for technology stack
    And User can see save edited technology stack button
    When User click on save edited technology stack button
    Then Notification message will appear
    And User can verify technology stack was edited
  Scenario: Delete technology stack
    And User can see delete technology stack button
    When User click on delete technology stack button
    Then Notification message will appear
    And User can verify technology stack was deleted
  Scenario: Add personal quality
    And User can see quality input field
    And User can enter value for quality
    And User can see save quality button
    When User click on save quality button
    Then Notification message will appear
    Then User can verify quality was created
  Scenario: Edit personal quality
    And User can see edit quality button
    When User click on edit quality button
    Then User can see edit quality input field
    And User can enter new value for quality
    And User can see save edited quality button
    When User click on save edited quality button
    Then Notification message will appear
    And User can verify quality was edited
  Scenario: Delete personal quality
    And User can see delete quality button
    When User click on delete quality button
    Then Notification message will appear
    And Use can verify qaulity was deleted