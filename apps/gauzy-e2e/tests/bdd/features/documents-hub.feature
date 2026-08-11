Feature: Documents hub
  As a user of Ever Gauzy
  I want a single Documents hub for uploads, wiki pages and review
  So that everything my organization writes or receives lives in one searchable place

  # The three end-to-end journeys required by specs/documents/10-implementation-plan.md §8.3:
  # upload -> browse -> detail, create page -> edit -> version, review -> approve -> visible.
  # The UX under test is specs/documents/01-ux-spec.md (nav entry §1, shell §2, tree §3, table §4.1,
  # filter bar §5, upload §7, detail panel §8, page editor §10, review queue §11).
  #
  # Every scenario is gated on the hub actually being reachable for this account: the nav entry and the
  # route both require FEATURE_DOCUMENTS on the organization plus DOCS_READ on the user. When that gate
  # is closed the scenario SKIPS with that reason instead of failing on a dashboard redirect.

  Background:
    Given I am logged in as the default user
    And the Documents hub is available

  Scenario: Upload a file, find it in the browse list and open its detail panel
    When I upload a file to the Documents hub
    And I find the uploaded document in the Documents hub list
    Then I can open the uploaded document in the Documents hub detail panel

  Scenario: Create a page, edit it in the rich editor and save a version
    When I create a new page in the Documents hub
    And I write content in the Documents hub page editor
    And I save a version of the Documents hub page
    Then the Documents hub version history lists the saved version

  Scenario: Approve a document from the review queue
    When I open the Documents hub review queue
    And I approve the first document waiting for review
    Then the approved document appears in the default Documents hub list
