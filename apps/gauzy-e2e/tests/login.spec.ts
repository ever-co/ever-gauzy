import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as logoutPage from './support/pages/Logout.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';

/**
 * Reference spec for the Cypress → Playwright migration.
 *
 * Ported from src/support/step_definitions/LoginTest.feature (+ its step defs).
 * Each Gherkin scenario becomes a Playwright test; the steps call the ported,
 * async page objects. `test` comes from ./support/fixtures so getPage() is bound.
 * Playwright tests are isolated, so the logout scenario logs in first (the
 * Cypress feature relied on shared state between scenarios).
 */
test.describe('Login', () => {
	test('login with email', async () => {
		await getPage().goto('/');
		await loginPage.verifyTitle();
		await loginPage.verifyLoginText();
		await loginPage.clearEmailField();
		await loginPage.enterEmail(LoginPageData.email);
		await loginPage.clearPasswordField();
		await loginPage.enterPassword(LoginPageData.password);
		await loginPage.clickLoginButton();
		await dashboardPage.verifyCreateButton();
	});

	test('logout after login', async () => {
		await getPage().goto('/');
		await loginPage.clearEmailField();
		await loginPage.enterEmail(LoginPageData.email);
		await loginPage.clearPasswordField();
		await loginPage.enterPassword(LoginPageData.password);
		await loginPage.clickLoginButton();
		await dashboardPage.verifyCreateButton();
		await dashboardPage.clickUserName();
		await logoutPage.clickLogoutButton();
		await loginPage.verifyLoginText();
	});
});
