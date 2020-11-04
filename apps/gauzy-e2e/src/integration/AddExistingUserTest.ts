import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addExistingUserPage from '../support/Base/pages/AddExistingUser.po';
import { AddExistingUserPageData } from '../support/Base/pagedata/AddExistingUserPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { AddOrganizationPageData } from '../support/Base/pagedata/AddOrganizationPageData';
import * as addOrganizationPage from '../support/Base/pages/AddOrganization.po';
import * as faker from 'faker';

let organizationName = ' ';
let taxId = ' ';

describe('Add existing user/s test', () => {
	before(() => {
		organizationName = faker.company.companyName();
		taxId = faker.random.alphaNumeric();

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
		cy.visit('/#/pages/organizations');
		addOrganizationPage.addBtnExists();
		addOrganizationPage.addBtnClick();
		addOrganizationPage.enterOrganizationName(organizationName);
		addOrganizationPage.selectCurrency(AddOrganizationPageData.currency);
		addOrganizationPage.enterOfficialName(organizationName);
		addOrganizationPage.enterTaxId(taxId);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.clickOnNextButton();
		cy.visit('/#/pages/users');
		addExistingUserPage.addExistingUsersButtonVisible();
		addExistingUserPage.clickAddExistingUsersButton();
		addExistingUserPage.cancelButtonVisible();
		addExistingUserPage.clickCancelButton();
		addExistingUserPage.tableBodyExists();
		addExistingUserPage.clickTableRow(AddExistingUserPageData.defaultUser);
		addExistingUserPage.clickTableRow(AddExistingUserPageData.defaultUser);
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
		addExistingUserPage.organizationDropdownVisible();
		addExistingUserPage.clickOrganizationDropdown();
		addExistingUserPage.selectOrganizationFromDropdown();
		addExistingUserPage.clickAddExistingUsersButton();
		addExistingUserPage.usersMultyselectVisible();
		addExistingUserPage.clickUsersMultyselect();
		addExistingUserPage.selectUsersFromDropdown(0);
		addExistingUserPage.clickKeyboardButtonByKeyCode(9);
		addExistingUserPage.saveUsersButtonVisible();
		addExistingUserPage.clickSaveUsersButton();
		addExistingUserPage.clickTableRow(AddExistingUserPageData.defaultUser);
		addExistingUserPage.removeUserButtonVisible();
		addExistingUserPage.clickRemoveUserButton();
		addExistingUserPage.confirmRemoveUserBtnVisible();
		addExistingUserPage.clickConfirmRemoveUserBtn();
	});
});
