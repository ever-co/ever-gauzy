Feature: Change Language Test
  Scenario: Login with email
    Given Login with default credentials
  Scenario: Verify settings bar
    Then User verify settings button is visible
    And User click settings button
  Scenario: Change language to Bulgarian
    Then User see language selector
    When User click on language select button
    Then User see language options
    And User click on Bulgarian language
    Then User can verify language is changed to Bulgarian
  Scenario: Change language to English
    Then User see language selector
    When User click on language select button
    Then User see language options
    And User click on English language
    Then User can verify language is changed to English
  Scenario: Change language to Russian
    Then User see language selector
    When User click on language select button
    Then User see language options
    And User click on Russian language
    Then User can verify language is changed to Russian
  Scenario: Change language to Hebrew
    Then User see language selector
    When User click on language select button
    Then User see language options
    And User click on Hebrew language
    Then User can verify language is changed to Hebrew
