Feature: Job proposals
  As a user of Ever Gauzy
  I want to manage job proposal templates
  So that I can reuse and standardise the proposals I send for jobs

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit, make default and delete a job proposal
    When I add a new job proposal
    And I edit the job proposal
    And I make the job proposal default
    And I delete the job proposal
