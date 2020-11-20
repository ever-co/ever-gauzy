import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as removeUserPage from '../support/Base/pages/RemoveUser.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Remove user test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to remove user', () => {
		cy.visit('/#/pages/users');
		removeUserPage.gridButtonVisible();
		removeUserPage.clickGridButton();
		removeUserPage.tableBodyExists();
		removeUserPage.clickTableRow(2);
		removeUserPage.removeButtonVisible();
		removeUserPage.clickRemoveButton();
		removeUserPage.confirmRemoveBtnVisible();
		removeUserPage.clickConfirmRemoveButton();
	});
});
