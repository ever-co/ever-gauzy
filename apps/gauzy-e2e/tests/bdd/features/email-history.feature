Feature: Email history
  As a user of Ever Gauzy
  I want to browse the localized email templates in the email history settings
  So that I can confirm every notification template is available in all supported languages

  Background:
    Given I am logged in as the default user

  Scenario: Verify every email template appears in all supported languages and a badge can be saved
    When I verify the Appointment Cancellation email templates
    And I verify the Appointment Confirmation email templates
    And I verify the Candidate Schedule Interview email templates
    And I verify the Email Appointment email templates
    And I verify the Email Estimate email templates
    And I verify the Email Invoice email templates
    And I verify the Equipment email templates
    And I verify the Equipment Request email templates
    And I verify the Interviewer Interview Schedule email templates
    And I verify the Invite Employee email templates
    And I verify the Invite Organization Client email templates
    And I verify the Invite User email templates
    And I verify the Password email templates
    And I verify the Payment Receipt email templates
    And I verify the Task Update email templates
    And I verify the Time Off Report Action email templates
    And I verify the Timesheet Action email templates
    And I verify the Timesheet Delete email templates
    And I verify the Timesheet Overview email templates
    And I verify the Timesheet Submit email templates
    And I verify the Welcome User email templates
    And I verify the email history badge
