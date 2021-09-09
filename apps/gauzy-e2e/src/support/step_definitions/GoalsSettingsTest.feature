Feature: Goals Time frame and KPI test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new employee
    And User can add new employee
  Scenario: Add new time frame
    And User can visit Goals settings page
    And User can see second tab button
    When User click on second tab button
    Then User can see add time frame button
    When User click on add time frame button
    Then User can see time frame name input field
    And User can enter name for time frame
    And User can see start date input field
    And User can enter start date
    And User can see end date input field
    And User can enter and date
    And User can see save time frame button
    When User click on save time frame button
    Then Notification message will appear
  Scenario: Edit time frame
    And User can see time frame table
    When User click on time frame table row
    Then Edit time frame button will become active
    When User click on edit time frame button
    Then User can see edit time frame name input field
    And User can enter new time frame name
    And User can see save edited time frame button
    When User click on save edited time frame button
    Then Notification message will appear
  Scenario: Delete time frame
    And User can see time frame table again
    When User click on time frame table row again
    Then Delete time frame button will become active
    When USer click on delete time frame button
    Then User can see confirm delete time frame button
    When User click on confirm delete time frame button
    Then Notification message will appear
  Scenario: Add new KPI
    And User can see third tab button
    When User click on third tab button
    Then User can see add KPI button
    When User click on add KPI button
    Then User can see KPI name input field
    And User can enter KPI name
    And User can see KPI description input field
    And User can enter KPI description
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see KPI value input field
    And User can enter KPI value
    And user can see save KPI button
    When User click on save KPI button
    Then Notification message will appear
  Scenario: Edit KPI
    And User can see KPI table
    When User click on KPI table row
    Then Edit KPI button will become active
    When User click on edit KPI button
    Then User can see edit KPI name input field
    And User can enter new KPI name
    And User can see employee dropdown
    When User click on employee dropdown
    Then User can select employee from dropdown options
    And User can see save edited KPI button
    When User click on save edited KPI button
    Then Notification message will appear
  Scenario: Delete KPI
    And User can see KPI table again
    When User click on KPI table row again
    Then Delete KPI button will become active
    When User click on delete KPI button
    Then User can see confirm delete KPI button
    When User click on confirm delete KPI button
    Then Notification message will appear