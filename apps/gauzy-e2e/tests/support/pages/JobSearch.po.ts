import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	waitElementToHide,
	clickButtonByIndex,
	verifyElementNotExist,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { JobSearchPage } from '../../../src/support/Base/pageobjects/JobSearchPageObject';

// Robust hash navigation to /#/pages/jobs/search (mirrors ApprovalRequest.po gotoHashRoute).
// A bare goto('/#/pages/jobs/search') right after login (which lands on /#/pages/dashboard) is a
// SAME-DOCUMENT hash change: Playwright updates the URL but Angular's hash-router may never re-render,
// so the page stays on the dashboard and the Search-tab title input is never mounted (the observed
// failure — the dump DOM was still the dashboard). Fix: (1) bounce through #/pages/dashboard so the
// assignment to the target hash is ALWAYS a genuine hashchange; (2) if the job-search header still
// hasn't mounted, escape the SPA no-op with a HARD page.reload() of the target hash URL — a full
// document load re-bootstraps Angular directly onto the route and CANNOT be a same-document no-op.
export const navigateToJobSearch = async () => {
	const page = getPage();
	// The card h4 projects "Job Search" via <ngx-header-title> — distinct from any other screen's header.
	const header = page.locator('h4:has-text("Job Search")').first();
	// Unconditional dashboard bounce so the following target-hash assignment is a REAL hashchange.
	await page.evaluate(() => {
		location.hash = '#/pages/dashboard';
	});
	await page.waitForTimeout(300);
	await page.evaluate(() => {
		location.hash = '#/pages/jobs/search';
	});
	try {
		await header.waitFor({ state: 'visible', timeout: 12_000 });
	} catch {
		// SPA hash nav wedged. location.hash is already the target, so a HARD reload re-bootstraps the
		// app directly onto the job-search route. Re-force the hash first in case the assignment was
		// swallowed, then reload.
		await page.evaluate(() => {
			if (location.hash.split('?')[0] !== '#/pages/jobs/search') {
				location.hash = '#/pages/jobs/search';
			}
		});
		await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
		await header.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
	}
	// The route has an IntegrationResolver — let its spinner clear before the caller interacts.
	await waitForSpinnerGone();
	await page.waitForTimeout(500);
};

// The Job Search input + advanced filter live inside the "Search" tab; the page opens on the
// "Browse" tab by default. Click the Search tab and let the SPA render the tab body before asserting.
export const clickSearchTab = async () => {
	await clickElementByText(JobSearchPage.searchTabCss, 'Search');
	await getPage().waitForTimeout(800);
};

export const searchInputVisible = async () => verifyElementIsVisible(JobSearchPage.searchInputCss);

export const filterButtonVisible = async () => verifyElementIsVisible(JobSearchPage.filterButtonCss);

export const hideAllButtonVisible = async () => verifyElementIsVisible(JobSearchPage.hideAllButtonCss);

export const clickHideAllButton = async () => clickButton(JobSearchPage.hideAllButtonCss);

export const confirmHideButtonVisible = async () => verifyElementIsVisible(JobSearchPage.confirmHideJobsButtonCss);

// The confirm ("Yes, Hide All Jobs") button lives in a freshly-opened nb-dialog; a coordinate/force click
// can be swallowed by the still-fading cdk-overlay-backdrop. dispatchClick fires a synthetic click straight
// on the element (bypassing the backdrop) which the button's (click)="close(true)" handler catches.
export const clickConfirmHideButton = async () => dispatchClick(JobSearchPage.confirmHideJobsButtonCss);

export const waitMessageToHide = async () => waitElementToHide(JobSearchPage.toastrMessageCss);

export const viewButtonVisible = async () => verifyElementIsVisible(JobSearchPage.viewButtonCss);

export const applyButtonVisible = async () => verifyElementIsVisible(JobSearchPage.applyButtonCss);

export const hideButtonVisible = async () => verifyElementIsVisible(JobSearchPage.hideButtonCs);

export const toggleButtonVisible = async () => verifyElementIsVisible(JobSearchPage.nbToggleCss);

export const clickToggleButton = async (index: number) => clickButtonByIndex(JobSearchPage.nbToggleCss, index);

export const refreshButtonVisible = async () => verifyElementIsVisible(JobSearchPage.refreshButtonCss);

export const refreshButtonNotVisible = async () => verifyElementNotExist(JobSearchPage.refreshButtonCss);
