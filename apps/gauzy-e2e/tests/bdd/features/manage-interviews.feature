Feature: Manage interviews
  As a recruiter in Ever Gauzy
  I want to schedule candidate interviews
  So that I can plan and track the hiring process for each candidate

  Background:
    Given I am logged in as the default user

  Scenario: Schedule an interview for a candidate
    When I add an interview for a candidate
