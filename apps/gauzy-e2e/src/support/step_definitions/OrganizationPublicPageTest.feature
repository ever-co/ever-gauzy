Feature: Organization public page test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add new organization
    And User can add new organization
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
    When User clicks on skills tab
    Then User can see skills dropdown
    When User clicks on skills dropdown
    Then User can select skills from dropdown options
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