Feature: Edit User Profile
  As a user of Ever Gauzy
  I want to edit my own user profile and re-authenticate
  So that I can confirm my saved credentials still let me log in

  Scenario: Edit the logged-in user's profile and log back in
    When I log in to edit my profile
    And I edit my user profile info
    And I log out from my profile
    And I log in again with the same credentials
