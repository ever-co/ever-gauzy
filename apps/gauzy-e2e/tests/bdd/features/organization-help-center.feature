Feature: Organization help center
  As a user of Ever Gauzy
  I want to manage help center knowledge bases
  So that I can organize and publish support content for my organization

  Background:
    Given I am logged in as the default user

  # @skip: this covers the LEGACY /pages/organization/help-center page, which
  # `featureDocumentsRedirectGuard` (apps/gauzy/src/app/pages/feature-documents-redirect.guard.ts)
  # redirects to the consolidated Documents hub at /pages/documents whenever FEATURE_DOCUMENTS is on
  # — as it is in the CI build, so the legacy page never renders. Wiki/knowledge-base content now
  # lives in the hub, covered by documents-hub.feature. Keep this scenario (do not delete): the guard
  # falls through to the legacy module while the flag is off.
  @skip
  Scenario: Add, edit and delete a help center base
    When I add a help center base
    And I edit the help center base
    And I delete the help center base
