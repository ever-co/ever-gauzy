Feature: Pipelines
  As a user of Ever Gauzy
  I want to manage sales pipelines
  So that I can track deals through the stages that fit my sales process

  Background:
    Given I am logged in as the default user

  Scenario: Add, edit and delete a pipeline
    When I add a new pipeline
    And I edit the pipeline
    And I delete the pipeline
