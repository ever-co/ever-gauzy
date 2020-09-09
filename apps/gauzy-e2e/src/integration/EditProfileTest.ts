import * as loginPage from '../support/Base/pages/Login.po';
import * as editProfilePage from '../support/Base/pages/EditProfile.po';
import * as faker from 'faker';
import { EditProfilePageData } from '../support/Base/pagedata/EditProfilePageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as logoutPage from '../support/Base/pages/Logout.po';

let firstName = ' ';
let lastName = ' ';
let password = ' ';
let email = ' ';

describe('Edit user profile test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		email = faker.internet.email();
		password = faker.internet.password();

		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(EditProfilePageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(EditProfilePageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should be able to edit user profile info', () => {
		cy.visit('/#/pages/auth/profile');
		editProfilePage.firstNameInputVisible();
		editProfilePage.lastNameInputVisible();
		editProfilePage.passwordInputVisible();
		editProfilePage.repeatPasswordInputVisible();
		editProfilePage.emailInputVisible();
		editProfilePage.languageSelectVisible();
		editProfilePage.saveBtnExists();
		editProfilePage.enterFirstNameData(firstName);
		editProfilePage.enterLastNameData(lastName);
		editProfilePage.enterPasswordData(password);
		editProfilePage.enterRepeatPasswordData(password);
		editProfilePage.enterEmailData(email);
		editProfilePage.chooseLanguage(EditProfilePageData.preferredLanguage);
		editProfilePage.saveBtnClick();
	});

	it('Should be able to logout', () => {
		dashboradPage.clickUserName();
		logoutPage.clickLogoutButton();
		loginPage.verifyLoginText();
	});

	it('Should be able to login with new credentials', () => {
		loginPage.verifyLoginButton();
		loginPage.clearEmailField();
		loginPage.enterEmail(email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});
});
