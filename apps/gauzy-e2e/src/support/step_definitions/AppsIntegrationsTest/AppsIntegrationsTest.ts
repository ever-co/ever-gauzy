import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as appsIntegrationsPage from '../../Base/pages/AppsIntegrations.po';
import { AppsIntegrationsPageData } from '../../Base/pagedata/AppsIntegrationsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Verify dropdown text
Then('User can visit Integrations page', () => {
	dashboardPage.verifyAccountingDashboard();
	cy.visit('/#/pages/integrations/list', { timeout: pageLoadTimeout });
	appsIntegrationsPage.verifyHeaderText(AppsIntegrationsPageData.header);
});

And('User can see All integrations dropdown', () => {
	appsIntegrationsPage.dropdownVisible();
});

When('User click on All integrations dropdown', () => {
	appsIntegrationsPage.clickDropdown(0);
});

Then('User can verify All integrations dropdown options', () => {
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
});

Then('User can click on All dropdown', () => {
	appsIntegrationsPage.clickDropdown(1);
});

And('User can verify All dropdown options', () => {
	appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.all);
	appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.paid);
	appsIntegrationsPage.verifyDropdownText(AppsIntegrationsPageData.free);
	appsIntegrationsPage.clickKeyboardButtonByKeyCode(9);
});

// Verify inputs
And('User can verify search input field', () => {
	appsIntegrationsPage.verifySearchInputVisible();
});

And('User can see clear search field button', () => {
	appsIntegrationsPage.clearButtonVisible();
});

And('User can see integrations list', () => {
	appsIntegrationsPage.verifyIntegrationList();
});

When('User click on Hubstaff integration option', () => {
	appsIntegrationsPage.clickIntegrationItem(0);
});

Then('User can verify card header', () => {
	appsIntegrationsPage.verifyCardHeaderText(
		AppsIntegrationsPageData.hubstaffHeader
	);
});

And('User can see client input field', () => {
	appsIntegrationsPage.clientIdInputVisible();
});

And('User can see back button', () => {
	appsIntegrationsPage.backButtonVisible();
});

When('User click on back button', () => {
	appsIntegrationsPage.clickBackButton();
});

Then(
	'User will go back to integration list and can click on Upwork option',
	() => {
		appsIntegrationsPage.clickIntegrationItem(1);
	}
);

And('User can verify Upwork header', () => {
	appsIntegrationsPage.verifyCardHeaderText(
		AppsIntegrationsPageData.upworkHeader
	);
});

And('User can see api key input field', () => {
	appsIntegrationsPage.apiKeyInputVisible();
});

And('User can see secret input field', () => {
	appsIntegrationsPage.secretInputVisible();
});
