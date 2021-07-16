Feature: Email history test
  Scenario: Login with email
    Given Login with default credentials and visit Email history page
  Scenario: Verify email templates dropdown
    Then User can verify Email history page
    And User can see filter button
    When User click on filter button
    Then User can see email templates dropdown
    When User click on email templates dropdown
    And User can verify  Appointment Cancellation templates
    And User can verify Appointment Confirmation templates
    And User can verify Candidate Schedule Interview templates
    And User can verify Email Appointment templates
    And User can verify Email Estimate templates
    And User can verify Email Invoice templates
    And User can verify Equipment templates
    And User can verify Equipment Request templates
    And User can verify Interviewer Interview Schedule templates
    And User can verify Invite Employee templates
    And User can verify Invite Organization Client templates
    And User can verify Invite User templates
    And User can verify Password templates
    And User can verify Payment Receipt templates
    And User can verify Task Update templates
    And User can verify Time Off Report Action templates
    And User can verify Timesheet Action templates
    And User can verify Timesheet Delete templates
    And User can verify Timesheet Overview templates
    And User can verify Timesheet Submit templates
    And User can verify Welcome User templates
  Scenario: Select template from dropdown
    And User can select template option from dropdown
    Then User can see save button
    When User click on save button
    Then User can verify badge