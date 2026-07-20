Feature: Job search
  As a user of Ever Gauzy
  I want to browse and manage the job search screen
  So that I can find, filter and hide job listings for my organization

  Background:
    Given I am logged in as the default user

  @skip
  Scenario: Verify job search visibility
    When I verify the job search visibility
