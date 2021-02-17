import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as jobSearchPage from '../support/Base/pages/JobSearch.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Job search test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to verify job search visibility', () => {
		cy.visit('/#/pages/jobs/search');
		jobSearchPage.searchInputVisible();
		jobSearchPage.filterButtonVisible();
		jobSearchPage.hideAllButtonVisible();
		jobSearchPage.clickHideAllButton();
		jobSearchPage.confirmHideButtonVisible();
		jobSearchPage.clickConfirmHideButton();
		jobSearchPage.waitMessageToHide();
		jobSearchPage.refreshButtonVisible();
		jobSearchPage.toggleButtonVisible();
		jobSearchPage.clickToggleButton(0);
		jobSearchPage.refreshButtonNotVisible();
		jobSearchPage.viewButtonVisible();
		jobSearchPage.applyButtonVisible();
		jobSearchPage.hideButtonVisible;
	});
});
