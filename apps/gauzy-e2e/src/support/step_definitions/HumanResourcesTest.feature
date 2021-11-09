Feature: Human resources test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Add employee
    And User can add new employee
  Scenario: Verify chart options
    And User can visit Dashboard accounting page
    And User can see employees dashboard
    When User select employee by name
    Then User can see chart dropdown
    When User click chart dropdown
    And User can verify bar chart
    And User can verify doughnut chart
    And User can verify stacked bar chart
  Scenario: Verify total income
    And User can verify total income section
    And User can verify total expense section
    And User can verify total expenses section
    And User can verify profit section
    When User click on total income section
    Then User can see popup with income header
    And user can see total income date table column
    And User can see total income contact table column
    And User can see total income value table column
    And Uer can see total income notes table column
  Scenario: Verify Total Expenses without salary
    When User click on Total expenses section
    Then User can see popup with expenses header
    And user can see total expenses source table column
    And User can see total expenses date table column
    And User can see total expenses vendor table column
    And Uer can see total expenses category table column
    And Uer can see total expenses value table column
    And Uer can see total expenses notes table column
  Scenario: Verify Profit
    When User click on Profit section
    Then User can see popup with profit header
    And user can see profit date table column
    And User can see profit expenses table column
    And User can see profit income table column
    And Uer can see profit description table column