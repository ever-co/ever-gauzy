Feature: Change interface language
  As a user of Ever Gauzy
  I want to switch the interface language from Quick Settings
  So that the application is shown in my preferred locale

  Background:
    Given I am logged in as the default user
    And I open the Quick Settings panel

  Scenario Outline: Switch the interface language to <language>
    When I select "<language>" as the interface language
    Then the interface is displayed in "<language>"

    Examples:
      | language  |
      | Bulgarian |
      | Russian   |
      | Hebrew    |
      | English   |
