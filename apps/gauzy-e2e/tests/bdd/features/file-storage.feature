Feature: File Storage
  As a user of Ever Gauzy
  I want to configure the file storage provider
  So that uploaded files are stored in my chosen S3 bucket

  Background:
    Given I am logged in as the default user

  Scenario: Configure an S3 file storage provider
    When I add an S3 file provider
