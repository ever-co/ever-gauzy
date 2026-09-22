Feature: SMS Gateways
  As a user of Ever Gauzy
  I want to configure SMS gateways
  So that I can enable and manage outbound SMS providers for my organization

  Background:
    Given I am logged in as the default user

  Scenario: Verify and toggle an SMS gateway
    When I verify the SMS gateways settings
