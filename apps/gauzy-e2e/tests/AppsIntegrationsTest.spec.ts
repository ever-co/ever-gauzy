import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as appsIntegrationsPage from './support/pages/AppsIntegrations.po';
import { AppsIntegrationsPageData } from '../src/support/Base/pagedata/AppsIntegrationsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Apps integrations page test', () => {
	test('Apps integrations page test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify dropdown text', async () => {
			await getPage().goto('/#/pages/integrations/new');
			await appsIntegrationsPage.verifyHeaderText(AppsIntegrationsPageData.header);
			await appsIntegrationsPage.dropdownVisible();
			await appsIntegrationsPage.clickDropdown(0);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.allIntegrations);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.forSalesTeams);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.forAccountants);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.forSupportTeams);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.crm);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.scheduling);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.tools);
			await appsIntegrationsPage.clickKeyboardButtonByKeyCode(9);
			await appsIntegrationsPage.clickDropdown(1);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.all);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.paid);
			await appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.free);
			await appsIntegrationsPage.clickKeyboardButtonByKeyCode(9);
		});

		await test.step('Should be able to verify inputs', async () => {
			await appsIntegrationsPage.verifySearchInputVisible();
			await appsIntegrationsPage.clearButtonVisible();
			await appsIntegrationsPage.verifyIntegrationList();
			await appsIntegrationsPage.clickIntegrationItem(0);
			await appsIntegrationsPage.verifyCardHeaderText(AppsIntegrationsPageData.hubstaffHeader);
			await appsIntegrationsPage.clientIdInputVisible();
			await appsIntegrationsPage.backButtonVisible();
			await appsIntegrationsPage.clickBackButton();
			await appsIntegrationsPage.clickIntegrationItem(1);
			await appsIntegrationsPage.verifyCardHeaderText(AppsIntegrationsPageData.upworkHeader);
			await appsIntegrationsPage.apiKeyInputVisible();
			await appsIntegrationsPage.secretInputVisible();
			await appsIntegrationsPage.backButtonVisible();
			await appsIntegrationsPage.clickBackButton();
		});
	});
});
