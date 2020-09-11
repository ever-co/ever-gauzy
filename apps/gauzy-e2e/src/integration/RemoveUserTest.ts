import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as removeUserPage from '../support/Base/pages/RemoveUser.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Remove user test', () => {
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
	it('Should be able to remove user', () => {
		cy.visit('/#/pages/users');
		removeUserPage.gridButtonVisible();
		removeUserPage.clickGridButton();
		removeUserPage.tableBodyExists();
		removeUserPage.clickTableRow(3);
		removeUserPage.removeButtonVisible();
		removeUserPage.clickRemoveButton();
		removeUserPage.confirmRemoveBtnVisible();
		removeUserPage.clickConfirmRemoveButton();
	});
});
