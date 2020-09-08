import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as deleteOrganizationPage from '../support/Base/pages/DeleteOrganization.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Delete Organization Test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should able to delete organization', () => {
		cy.visit('/#/pages/organizations');
		deleteOrganizationPage.gridBtnExists();
		deleteOrganizationPage.gridBtnClick();
		deleteOrganizationPage.deleteBtnExists();
		deleteOrganizationPage.deleteBtnClick();
		deleteOrganizationPage.confirmBtnExists();
		deleteOrganizationPage.confirmBtnClick();
	});
});
