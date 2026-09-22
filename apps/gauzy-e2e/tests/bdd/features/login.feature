Feature: Login
  As a registered user of Ever Gauzy
  I want to sign in with my email and password
  So that I can reach my organization's dashboard

  Scenario: Log in with email and password
    When I sign in with the default credentials
    Then I land on the dashboard

  Scenario: Log out after logging in
    Given I am logged in as the default user
    When I log out
    Then I am returned to the login screen
