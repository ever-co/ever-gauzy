import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as customSMTPPage from '../../Base/pages/CustomSMTP.po';
import { CustomSMTPPageData } from '../../Base/pagedata/CustomSMTPPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let username = faker.internet.userName();
let password = faker.internet.password();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new transfer protocol
Then('User can visit Custom SMTP page', () => {
	cy.visit('/#/pages/settings/custom-smtp/tenant', { timeout: pageLoadTimeout });
});

And('User can see host input field', () => {
	customSMTPPage.hostInputVisible();
});

And('User can enter value for host', () => {
	customSMTPPage.enterHostInputData(CustomSMTPPageData.host);
});

And('User can see port input field', () => {
	customSMTPPage.portInputVisible();
});

And('User can enter value for port', () => {
	customSMTPPage.enterPortInputData(CustomSMTPPageData.port);
});

And('User can see secure dropdown', () => {
	customSMTPPage.secureDropdownVisible();
});

When('User click on secure dropdown', () => {
	customSMTPPage.clickSecureDropdown();
});

Then('User can select option from dropdown', () => {
	customSMTPPage.selectSecureOptionFromDropdown(CustomSMTPPageData.secure);
});

And('User can see username input field', () => {
	customSMTPPage.usernameInputVisible();
});

And('User can enter value for username', () => {
	customSMTPPage.enterUsernameInputData(username);
});

And('User can see password input field', () => {
	customSMTPPage.passwordInputVisible();
});

And('User can enter value for password', () => {
	customSMTPPage.enterPasswordInputData(password);
});

And('User can see save button', () => {
	customSMTPPage.saveButtonVisible();
});

And('User can click on save button', () => {
	customSMTPPage.clickSaveButton();
});
