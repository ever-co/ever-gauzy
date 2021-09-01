Feature: Register test
  Scenario: Create new account
    Given Visit home page as unauthorized user
    When User can click on register link
    Then User can enter full name
    And User can enter email address
    And User can enter password
    And User can repeat password
    And User can click on terms and conditions checkbox
    When User click on click on register button
  Scenario: Create first organization
    Then User will be redirected to create first organization and add organization name
    And User can select currency
    And User can enter organization official name
    And User can enter tax id
    When User click on next button
    Then User can see country dropdown
    When User click on country dropdown
    Then User can select country from dropdown options
    And User can see city input field
    And User can enter value for city
    And User can see postcode input field
    And User can enter value for postcode
    And User can see street input field
    And User can enter value for street
    When User click on next button
    Then User can see bonus type dropdown
    When User click on bonus type dropdown
    Then User can select bonus type from dropdown options
    And User can see bonus percentage input field
    And User can enter bonus percentage data
    When User click on next button
    Then User can see timezone dropdown
    When User click on timezone dropdown
    Then User can select timezone from dropdown options
    And User can see start of week dropdown
    When User click on start week dropdown
    Then User can select start of week option
    And User can see date type dropdown
    When User click on date type dropdown
    Then User can select date type from dropdown
    And User can see region dropdown
    When User click on region dropdown
    Then User can select region from dropdown
    And User can see number format dropdown
    When User click on number format dropdown
    Then User can select number format from dropdown
    And User can see date format dropdown
    When User click on date format dropdown
    Then User can select date format from dropdown
    And User can see expiry period input field
    And User can enter value for expiry period
    When User click on next button
    Then User can verify complete page
    When User click on dashboard
    Then User can see home page as authorized user
  Scenario: Logout
    When User click on username
    Then User can click on logout button
    And User can see login page
  Scenario: Login with same credentials
    And User can see login button
    And User can see email input field
    And User can enter value for email
    And User can see password input field
    And User can enter value for password
    When User click on login button
    Then User will be redirected to home page as authorized user