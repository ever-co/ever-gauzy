Feature: Add SMTP server
  As a user of Ever Gauzy
  I want to configure a custom SMTP transfer protocol for my tenant
  So that the platform can send emails through my own mail server

  Background:
    Given I am logged in as the default user

  Scenario: Add a custom SMTP server
    When I add a new SMTP transfer protocol
