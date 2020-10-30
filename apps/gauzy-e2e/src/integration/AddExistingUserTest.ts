import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addExistingUserPage from '../support/Base/pages/AddExistingUser.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Add existing user/s test', () => {
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

	it('Should be able to add existing user/s', () => {
		cy.visit('/#/pages/users');
		addExistingUserPage.addExistingUsersButtonVisible();
		addExistingUserPage.clickAddExistingUsersButton();
		addExistingUserPage.cancelButtonVisible();
		addExistingUserPage.clickCancelButton();
		addExistingUserPage.tableBodyExists();
		addExistingUserPage.clickTableRow(0);
		addExistingUserPage.clickTableRow(0);
		addExistingUserPage.removeUserButtonVisible();
		addExistingUserPage.clickRemoveUserButton();
		addExistingUserPage.confirmRemoveUserBtnVisible();
		addExistingUserPage.clickConfirmRemoveUserBtn();
		addExistingUserPage.clickAddExistingUsersButton();
		addExistingUserPage.usersMultyselectVisible();
		addExistingUserPage.clickUsersMultyselect();
		addExistingUserPage.selectUsersFromDropdown(0);
		addExistingUserPage.clickKeyboardButtonByKeyCode(9);
		addExistingUserPage.saveUsersButtonVisible();
		addExistingUserPage.clickSaveUsersButton();
	});
});
