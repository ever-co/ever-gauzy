import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as editUserPage from '../support/Base/pages/EditUser.po';
import * as faker from 'faker';
import { EditUserPageData } from '../support/Base/pagedata/EditUserPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

let firstName = ' ';
let lastName = ' ';
let password = ' ';
let email = ' ';

describe('Edit user test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		email = faker.internet.email();
		password = faker.internet.password();

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

	it('Should be able to edit user', () => {
		cy.visit('/#/pages/users');
		editUserPage.gridButtonVisible();
		editUserPage.clickGridButton();
		editUserPage.editButtonVisible();
		editUserPage.clickEditButton();
		editUserPage.firstNameInputVisible();
		editUserPage.lastNameInputVisible();
		editUserPage.passwordInputVisible();
		editUserPage.repeatPasswordInputVisible();
		editUserPage.emailInputVisible();
		editUserPage.tagsMultyselectVisible();
		editUserPage.selectRoleVisible();
		editUserPage.languageSelectVisible();
		editUserPage.saveBtnExists();
		editUserPage.enterFirstNameData(firstName);
		editUserPage.enterLastNameData(lastName);
		editUserPage.enterPasswordData(password);
		editUserPage.enterRepeatPasswordData(password);
		editUserPage.enterEmailData(email);
		editUserPage.clickTagsMultyselect();
		editUserPage.selectTagsFromDropdown(0);
		editUserPage.selectTagsFromDropdown(1);
		editUserPage.clickKeyboardButtonByKeyCode(9);
		editUserPage.chooseRoleSelectData(EditUserPageData.role);
		editUserPage.chooseLanguage(EditUserPageData.preferredLanguage);
		editUserPage.saveBtnClick();
	});
});
