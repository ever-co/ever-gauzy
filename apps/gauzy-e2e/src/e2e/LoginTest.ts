import * as loginPage from '../support/Base/pages/Login.po';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import * as logoutPage from '../support/Base/pages/Logout.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';

describe('Login Test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
	});

	it('Should able to login with default credentials', () => {
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboardPage.verifyCreateButton();
	});

	it('Should able to logout', () => {
		dashboardPage.clickUserName();
		logoutPage.clickLogoutButton();
		loginPage.verifyLoginText();
	});
});
