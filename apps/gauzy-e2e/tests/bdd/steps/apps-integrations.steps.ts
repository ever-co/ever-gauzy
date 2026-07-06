import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as appsIntegrationsPage from '../../support/pages/AppsIntegrations.po';
import { AppsIntegrationsPageData } from '../../../src/support/Base/pagedata/AppsIntegrationsPageData';

// Converted 1:1 from the plain AppsIntegrationsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I verify the apps integrations dropdown text', async () => {
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

When('I verify the apps integrations inputs', async () => {
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
