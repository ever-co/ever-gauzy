Feature: Organization documents
  As a user of Ever Gauzy
  I want to manage organization documents
  So that I can keep reference links and files organised for my organization

  Background:
    Given I am logged in as the default user

  # @skip: this covers the LEGACY /pages/organization/documents page, which
  # `featureDocumentsRedirectGuard` (apps/gauzy/src/app/pages/feature-documents-redirect.guard.ts)
  # redirects to the consolidated Documents hub at /pages/documents whenever FEATURE_DOCUMENTS is on
  # — as it is in the CI build, so the legacy page never renders and its Add button cannot exist.
  # The hub is covered by documents-hub.feature. Keep this scenario (do not delete): the guard falls
  # through to the legacy module while the flag is off, so it is still the only coverage for that path.
  @skip
  Scenario: Add, edit and delete an organization document
    When I add a new document
    And I edit the document
    And I delete the document
