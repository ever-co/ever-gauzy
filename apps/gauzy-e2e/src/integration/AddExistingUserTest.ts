import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addExistingUserPage from '../support/Base/pages/AddExistingUser.po';
import { AddExistingUserPageData } from '../support/Base/pagedata/AddExistingUserPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Add existing user/s test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add existing user/s', () => {
		cy.visit('/#/pages/users');
		addExistingUserPage.addExistingUsersButtonVisible();
		addExistingUserPage.clickAddExistingUsersButton();
		addExistingUserPage.cancelButtonVisible();
		addExistingUserPage.clickCancelButton();
		addExistingUserPage.tableBodyExists();
		addExistingUserPage.clickTableRow(AddExistingUserPageData.defaultUser);
		addExistingUserPage.removeUserButtonVisible();
		addExistingUserPage.clickRemoveUserButton();
		addExistingUserPage.confirmRemoveUserBtnVisible();
		addExistingUserPage.clickConfirmRemoveUserBtn();
		addExistingUserPage.clickAddExistingUsersButton();
		addExistingUserPage.usersMultiSelectVisible();
		addExistingUserPage.clickUsersMultiSelect();
		addExistingUserPage.selectUsersFromDropdown(
			AddExistingUserPageData.defaultUser
		);
		addExistingUserPage.clickKeyboardButtonByKeyCode(9);
		addExistingUserPage.saveUsersButtonVisible();
		addExistingUserPage.clickSaveUsersButton();
	});
});
