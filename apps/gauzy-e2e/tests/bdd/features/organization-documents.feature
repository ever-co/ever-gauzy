Feature: Organization documents
  As a user of Ever Gauzy
  I want to manage organization documents
  So that I can keep reference links and files organised for my organization

  Background:
    Given I am logged in as the default user

  # Covers the LEGACY /pages/organization/documents page. `featureDocumentsRedirectGuard`
  # (apps/gauzy/src/app/pages/feature-documents-redirect.guard.ts) redirects that route to the
  # consolidated Documents hub whenever FEATURE_DOCUMENTS is on — as it is in CI — so the first step
  # skips at RUNTIME when it detects the redirect, rather than carrying a blanket @skip tag. That way
  # this stays real coverage for the flag-off path instead of dead weight. The hub itself is covered
  # by documents-hub.feature.
  Scenario: Add, edit and delete an organization document
    When I add a new document
    And I edit the document
    And I delete the document
