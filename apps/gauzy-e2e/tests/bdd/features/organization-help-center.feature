Feature: Organization help center
  As a user of Ever Gauzy
  I want to manage help center knowledge bases
  So that I can organize and publish support content for my organization

  Background:
    Given I am logged in as the default user

  # Covers the LEGACY /pages/organization/help-center page. `featureDocumentsRedirectGuard`
  # (apps/gauzy/src/app/pages/feature-documents-redirect.guard.ts) redirects that route to the
  # consolidated Documents hub whenever FEATURE_DOCUMENTS is on — as it is in CI — so the first step
  # skips at RUNTIME when it detects the redirect, rather than carrying a blanket @skip tag. Wiki and
  # knowledge-base content now lives in the hub, covered by documents-hub.feature.
  Scenario: Add, edit and delete a help center base
    When I add a help center base
    And I edit the help center base
    And I delete the help center base
