import * as loginPage from '../support/Base/pages/Login.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as logoutPage from '../support/Base/pages/Logout.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';

describe('Login Test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
	});

	it('Should able to login with default credentials', () => {
		loginPage.verfyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should able to logout', () => {
		dashboradPage.clickUserName();
		logoutPage.clickLogoutButton();
		loginPage.verfyLoginText();
	});
});
