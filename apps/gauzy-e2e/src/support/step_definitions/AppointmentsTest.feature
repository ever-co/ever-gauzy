Feature: Appointments test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    And User can add new employee
  Scenario: Book public appointment
    And User can visit Employees appointments page
    Then User can see book public appointment button
    When User click on book public appointment button
    Then User will see employee select
    When User click on employee select
    Then User can see employee dropdown options
    And User can choose employee from dropdown
    And User can see book appontment button
    When User click on book appontment button
    Then User can see select button
    When User click on select button
    Then User can verify header
    And User can verify employee