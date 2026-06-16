import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import * as editProfilePage from './support/pages/EditProfile.po';
import { EditProfilePageData } from '../src/support/Base/pagedata/EditProfilePageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as logoutPage from './support/pages/Logout.po';

test.describe('Edit user profile test', () => {
	test('Edit user profile test', async () => {
		await getPage().goto('/');
		await loginPage.verifyTitle();
		await loginPage.verifyLoginText();
		await loginPage.clearEmailField();
		await loginPage.enterEmail(EditProfilePageData.email);
		await loginPage.clearPasswordField();
		await loginPage.enterPassword(EditProfilePageData.password);
		await loginPage.clickLoginButton();
		await dashboardPage.verifyCreateButton();

		await test.step('Should be able to edit user profile info', async () => {
			await getPage().goto('/#/pages/auth/profile');
			await editProfilePage.firstNameInputVisible();
			await editProfilePage.lastNameInputVisible();
			await editProfilePage.passwordInputVisible();
			await editProfilePage.repeatPasswordInputVisible();
			await editProfilePage.emailInputVisible();
			await editProfilePage.languageSelectVisible();
			await editProfilePage.saveBtnExists();
			await editProfilePage.enterFirstNameData(EditProfilePageData.firstName);
			await editProfilePage.enterLastNameData(EditProfilePageData.lastName);
			await editProfilePage.enterPasswordData(EditProfilePageData.password);
			await editProfilePage.enterRepeatPasswordData(EditProfilePageData.password);
			await editProfilePage.enterEmailData(EditProfilePageData.email);
			await editProfilePage.chooseLanguage(EditProfilePageData.preferredLanguage);
			await editProfilePage.saveBtnClick();
		});

		await test.step('Should be able to logout', async () => {
			await dashboardPage.clickUserName();
			await logoutPage.clickLogoutButton();
			await loginPage.verifyLoginText();
		});

		await test.step('Should be able to login with new credentials', async () => {
			await loginPage.verifyLoginButton();
			await loginPage.clearEmailField();
			await loginPage.enterEmail(EditProfilePageData.email);
			await loginPage.clearPasswordField();
			await loginPage.enterPassword(EditProfilePageData.password);
			await loginPage.clickLoginButton();
			await dashboardPage.verifyCreateButton();
		});
	});
});
