import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as jobSearchPage from './support/pages/JobSearch.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Job search test', () => {
	test('Job search test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify job search visibility', async () => {
			await getPage().goto('/#/pages/jobs/search');
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
