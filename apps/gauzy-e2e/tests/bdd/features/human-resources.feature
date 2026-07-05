Feature: Human resources page
  As a user of Ever Gauzy
  I want to review the human resources accounting dashboard
  So that I can inspect employee charts, income, expenses and profit at a glance

  Background:
    Given I am logged in as the default user

  Scenario: Review employee accounting charts, income, expenses and profit
    When I verify the employee chart options
    And I verify the Total Income card
    And I verify the Total Expenses without salary card
    And I verify the Total Expenses card
    And I verify the Profit card
