Feature: Manage organization test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new organization
    And User can add new organization
  Scenario: Manage organization
    And User can see grid button
    And User can click on second grid button to change view
    When User select organizations table row
    Then Manage button will become active
    When User click on manage button
    Then User can enter organization name
    And User can select currency
    And User can enter official name
    And User can enter tax id
    And User can see tab button
    When User click on second tab button
    Then User can see country dropdown
    When User click on country dropdown
    Then User can select country from dropdown options
    And User can see city input field
    And User can enter value for city
    And User can see post code input field
    And User can enter value for post code
    And User can see street input field
    And User can enter value for street
    And User can see tab button
    When User click on third tab button
    Then User can see time zone dropdown
    When User click on time zone dropdown
    Then User can select time zone option from dropdown
    And User can see start of week dropdown
    When User click on start of week dropdown
    Then User can select start of week option from dropdown
    And User can see date type dropdown
    When User click on date type dropdown
    Then User can select date type from dropdown options
    And User can see region dropdown
    When User click on region dropdown
    Then User can select region from dropdown options
    And User can see number format dropdown
    When User click on number format dropdown
    Then User can select number format from dropdown options
    And User can see date format dropdown
    When User click on date format dropdown
    Then User can select date format from dropdown options
    When User click on first tab button
    Then User can see save button
    When User click on save button
    Then Notification message will appear
    And User can verify organization