import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as jobSearchPage from './support/pages/JobSearch.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Job search test', () => {
	test('Job search test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify job search visibility', async () => {
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
	});
});
