Feature: Book public appointment
  As a user of Ever Gauzy
  I want to book a public appointment for an employee
  So that clients can schedule time with the right team member

  Background:
    Given I am logged in as the default user

  Scenario: Book a public appointment for an employee
    When I book a public appointment
