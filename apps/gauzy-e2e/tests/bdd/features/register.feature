Feature: Register
  As a new visitor to Ever Gauzy
  I want to register an account and set up my first organization
  So that I can sign in and start using the platform

  Scenario: Register a new account, onboard an organization, then log out and back in
    When I create a new account
    And I create my first organization
    And I log out of the newly registered account
    And I log in with the newly registered credentials
