import * as loginPage from '../../Base/pages/Login.po';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Visit home page as unauthorised user', () => {
	cy.visit('/', { timeout: pageLoadTimeout });
	loginPage.verifyTitle();
});

Then('User can see login text', () => {
	loginPage.verifyLoginText();
});

And('User cane see email input', () => {
	loginPage.clearEmailField();
});

And('Use can enter value for email', () => {
	loginPage.enterEmail(LoginPageData.email);
});

And('User cane see password input', () => {
	loginPage.clearPasswordField();
});

And('Use can enter value for password', () => {
	loginPage.enterPassword(LoginPageData.password);
});

When('User click on login button', () => {
	loginPage.clickLoginButton();
});

Then('User will see Create button', () => {
	dashboardPage.verifyCreateButton();
});

// Logout
When('User click on username', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	dashboardPage.clickUserName();
});

Then('User can see and click on logout button', () => {
	logoutPage.clickLogoutButton();
});

And('User can see again login text', () => {
	loginPage.verifyLoginText();
});
