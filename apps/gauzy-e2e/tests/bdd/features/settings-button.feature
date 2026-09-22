Feature: Settings button
  As a user of Ever Gauzy
  I want to use the Quick Settings button
  So that I can switch the interface language, layout and light/dark theme

  Background:
    Given I am logged in as the default user

  Scenario: Open Quick Settings and switch language, layout and theme
    When I open Quick Settings and verify the language options
    And I verify the layout options
    And I verify the body light and dark themes via the toggle
    And I switch to the Bulgarian language
    And I switch to the Russian language
    And I switch to the Hebrew language
    And I switch back to the English language
