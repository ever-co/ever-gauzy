Feature: Validate email templates
  As a user of Ever Gauzy
  I want to preview each system email template in every supported language
  So that I can confirm the localized subjects render correctly before sending

  Background:
    Given I am logged in as the default user

  Scenario: Validate every email template subject across languages
    When I validate the Password Reset email template
    And I validate the Appointment Confirmation email template
    And I validate the Appointment Cancellation email template
    And I validate the Time Off Policy email template
    And I validate the Task Update email template
    And I validate the Equipment Create email template
    And I validate the Equipment Request email template
    And I validate the Time Sheet Overview email template
    And I validate the Time Sheet Submit email template
    And I validate the Time Sheet Actions email template
    And I validate the Time Sheet Delete email template
    And I validate the Candidate Interview Schedule email template
    And I validate the Interviewer Schedule email template
    And I validate the Welcome User email template
    And I validate the Invite Organization Client email template
    And I validate the Invite Employee email template
    And I validate the Invite User email template
    And I validate the Email Invoice email template
    And I validate the Email Estimate email template
