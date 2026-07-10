Feature: Danger Zone
  As a user of Ever Gauzy
  I want to review the danger zone account settings
  So that I can safely reach the delete-account controls without accidental data loss

  Background:
    Given I am logged in as the default user

  # @skip: the danger-zone delete-account/delete-all-data controls are gated behind `@if (!environment.DEMO)`
  # (danger-zone.component.html), and this repo's web build hardcodes DEMO=true (no build config yields
  # DEMO=false — the "demo account" banner in every run confirms it). So the controls never render and this
  # can't pass. The original plain spec was test.describe.skip for the same reason; preserve that here.
  @skip
  Scenario: Verify the danger zone delete-account controls
    When I verify the danger zone
