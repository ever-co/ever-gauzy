import { When } from '../../support/bdd';
import * as jobSearchPage from '../../support/pages/JobSearch.po';

// Converted 1:1 from the plain JobSearchTest.spec.ts: the single test() -> one Scenario, its single
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I verify the job search visibility', async () => {
	// A bare hash goto() right after login (which lands on /#/pages/dashboard) is a
	// same-document no-op — the Angular hash-router never re-renders and the page stays on the
	// dashboard (confirmed: the failure DOM was still the dashboard). navigateToJobSearch bounces
	// through the dashboard hash to force a real hashchange, waits for the "Job Search" header,
	// and hard-reloads onto the route if the SPA nav wedges — so the screen actually mounts.
	await jobSearchPage.navigateToJobSearch();
	// The search input + advanced filter only render inside the "Search" tab; activate it first.
	await jobSearchPage.clickSearchTab();
	await jobSearchPage.searchInputVisible();
	await jobSearchPage.filterButtonVisible();
	await jobSearchPage.hideAllButtonVisible();
	await jobSearchPage.clickHideAllButton();
	await jobSearchPage.confirmHideButtonVisible();
	await jobSearchPage.clickConfirmHideButton();
	await jobSearchPage.waitMessageToHide();
	await jobSearchPage.refreshButtonVisible();
	await jobSearchPage.toggleButtonVisible();
	await jobSearchPage.clickToggleButton(0);
	await jobSearchPage.refreshButtonNotVisible();
	await jobSearchPage.viewButtonVisible();
	await jobSearchPage.applyButtonVisible();
	jobSearchPage.hideButtonVisible;
});
