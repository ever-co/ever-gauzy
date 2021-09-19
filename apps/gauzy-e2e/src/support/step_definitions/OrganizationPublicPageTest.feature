Feature: Organization public page test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new organization
    Then User can see grid button
    And User can click on second grid button to change view
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
  Scenario: Add employee
    And User can add new employee
  Scenario: Add project
    And User can add new project
  Scenario: Add new client
    And User can add new client
  Scenario: Add new public profile link
    And User can navigate to organizations page
    And User can see organization name filter input field
    When User enters organization name filter input value
    Then User can see filtered organization
    When User selects organization from table row
    Then Manage button will become active
    When User clicks on manage button
    Then User can see profile link input field
    And User enters profile link value
    Then User can see save button
    When User clicks on save button
    Then Notification message will appear
  Scenario: Edit public page
    And User can navigate to organization public page
    And User can see Edit Page button
    When User clicks on Edit Page button
    Then User can see company name input field
    And User enters company name value
    And User can see company size input field
    And User enters company size value
    And User can see year founded input field
    And User enters year founded value
    And User can see banner input field
    And User enters banner value
    And User see minimum project size dropdown
    When User clicks on minimum project size dropdown
    Then User can select minimum project size from dropdown options
    And User can see client focus dropdown
    When User clicks on client focus dropdown
    Then User can select client focus from dropdown options
    And User can see short description input field
    And User enters short description value
    And User can see awards tab
    When User clicks on awards tab
    Then Use can see add award button
    When User clicks on award button
    Then User can see award name input field
    And User enters award name value
    And User can see award year input field
    And User enters award year value
    And User can see save award button
    When User clicks on save award button
    Then Notification message will appear
    And User can see skills tab
    And User can see languages tab
    When User clicks on languages tab
    Then User can see add language button
    When User clicks on add language button
    Then User can see language dropdown
    When User clicks on language dropdown
    Then User can select language from dropdown options
    And User can see language level dropdown
    When User clicks on language level dropdown
    Then User can select language level from dropdown options
    And User can see save language button
    When User clicks on save language button
    Then Notification message will appear
    And User can see Update button
    When User clicks on Update button
    Then Notification message will appear
  Scenario: Verify public page data
    And User can verify company name
    And User can verify banner
    And User can verify company size
    And User can verify total clients
    And User can verify client focus