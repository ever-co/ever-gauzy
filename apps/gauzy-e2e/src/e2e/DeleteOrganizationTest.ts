import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as deleteOrganizationPage from '../support/Base/pages/DeleteOrganization.po';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Delete Organization Test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should able to delete organization', () => {
		cy.visit('/#/pages/organizations');
		deleteOrganizationPage.gridBtnExists();
		deleteOrganizationPage.gridBtnClick();
		deleteOrganizationPage.deleteBtnExists();
		deleteOrganizationPage.deleteBtnClick();
		deleteOrganizationPage.confirmBtnExists();
		deleteOrganizationPage.confirmBtnClick();
	});
});
