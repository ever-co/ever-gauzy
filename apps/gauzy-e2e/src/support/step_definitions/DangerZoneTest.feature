Feature: Danger zone test
  Scenario: Login with email
    Given Login with default credentials and visit Danger zone page
  Scenario: Danger zone page test
    Then User can verify Danger zone page
    And User can see delete button
    When User click on delete button
    Then User can see confirm delete text
    And User can input field
    And User can enter data into input field
    Then User can see confirm delete button
    And User can see cancel delete button
    When User click on cancel delete button
    Then User can see again delete button