import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as appsIntegrationsPage from '../support/Base/pages/AppsIntegrations.po';
import { AppsIntegrationsPageData } from '../support/Base/pagedata/AppsIntegrationsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Apps integrations page test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to verify dropdown text', () => {
		cy.visit('/#/pages/integrations/list');
		appsIntegrationsPage.verifyHeaderText(AppsIntegrationsPageData.header);
		appsIntegrationsPage.dropdownVisible();
		appsIntegrationsPage.clickDropdown(0);
		appsIntegrationsPage.verifyDropdownText(
			AppsIntegrationsPageData.allIntegrations
		);
		appsIntegrationsPage.verifyDropdownText(
			AppsIntegrationsPageData.forSalesTeams
		);
		appsIntegrationsPage.verifyDropdownText(
			AppsIntegrationsPageData.forAccountants
		);
		appsIntegrationsPage.verifyDropdownText(
			AppsIntegrationsPageData.forSupportTeams
		);
		appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.crm);
		appsIntegrationsPage.verifyDropdownText(
			AppsIntegrationsPageData.scheduling
		);
		appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.tools);
		appsIntegrationsPage.clickKeyboardButtonByKeyCode(9);
		appsIntegrationsPage.clickDropdown(1);
		appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.all);
		appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.paid);
		appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.free);
		appsIntegrationsPage.clickKeyboardButtonByKeyCode(9);
	});
	it('Should be able to verify inputs', () => {
		appsIntegrationsPage.verifySearchInputVisible();
		appsIntegrationsPage.clearButtonVisible();
		appsIntegrationsPage.verifyIntegrationList();
		appsIntegrationsPage.clickIntegrationItem(0);
		appsIntegrationsPage.verifyCardHeaderText(
			AppsIntegrationsPageData.hubstaffHeader
		);
		appsIntegrationsPage.clientIdInputVisible();
		appsIntegrationsPage.backButtonVisible();
		appsIntegrationsPage.clickBackButton();
		appsIntegrationsPage.clickIntegrationItem(1);
		appsIntegrationsPage.verifyCardHeaderText(
			AppsIntegrationsPageData.upworkHeader
		);
		appsIntegrationsPage.apiKeyInputVisible();
		appsIntegrationsPage.secretInputVisible();
		appsIntegrationsPage.backButtonVisible();
		appsIntegrationsPage.clickBackButton();
	});
});
