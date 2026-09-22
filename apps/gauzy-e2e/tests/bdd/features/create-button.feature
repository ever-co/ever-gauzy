Feature: Create button
  As a user of Ever Gauzy
  I want to open the Quick Actions dialog from the "+ Create" header button
  So that I can quickly navigate to create any supported record

  Background:
    Given I am logged in as the default user

  Scenario: Open, inspect and close the Quick Actions dialog
    When I open the Quick Actions dialog
    And I see the quick action group headers
    And I see each quick action option
    And I close the Quick Actions dialog
