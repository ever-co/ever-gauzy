Feature: Add Organization
  Scenario: Login with email
    Given Login with default credentials and visit Organizations page
  Scenario: Add new organization
    Then User can see Add new organization button
    When User click on Add new organization button
    Then User can add value for organization name
    And User can select currency
    And User can enter value for official name
    And User can add tax id value
    When User click on Next button
    Then User can see country dropdown
    When User click on country dropdown
    Then User can select country from dropdown option
    And User can see city input field
    And User can add value for city
    And User can see post code input field
    And User can add value for post code
    And User can see street input field
    And User can add value for street
    Then User can click on Next button
    And User can see bonus dropdown
    When User click on bonus dropdown
    Then User can select bonus from dropdown options
    And User can see bonus input field
    And User can enter value for bonus
    Then User can click next button
    And User can see time zone dropdown
    When User click on time zone dropdown
    Then User can select time zone from dropdown options
    And User can see start of week dropdown
    When User click on start of week dropdown
    Then User can select day of week from dropdown options
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
    And User can see expiry date input field
    And User can enter value for expiry date
    When User click on last Next button
    Then Notification message will appear
    And User can verify organization was created