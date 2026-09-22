import { When, Then } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as loginPage from '../../support/pages/Login.po';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import * as logoutPage from '../../support/pages/Logout.po';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';

// Converted from the plain login.spec.ts (itself ported from the legacy LoginTest.feature). The two
// isolated tests become two isolated Scenarios. The "Log in" scenario exercises the login flow
// EXPLICITLY (its own steps below); the "Log out" scenario reuses the shared `Given I am logged in as
// the default user` (common.steps.ts) for its setup, then logs out. Bodies are the verbatim .po
// sequences from the plain spec, so runtime is identical.

When('I sign in with the default credentials', async () => {
	await getPage().goto('/');
	await loginPage.verifyTitle();
	await loginPage.verifyLoginText();
	await loginPage.clearEmailField();
	await loginPage.enterEmail(LoginPageData.email);
	await loginPage.clearPasswordField();
	await loginPage.enterPassword(LoginPageData.password);
	await loginPage.clickLoginButton();
});

Then('I land on the dashboard', async () => {
	await dashboardPage.verifyCreateButton();
});

When('I log out', async () => {
	await dashboardPage.clickUserName();
	await logoutPage.clickLogoutButton();
});

Then('I am returned to the login screen', async () => {
	await loginPage.verifyLoginText();
});
