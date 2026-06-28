import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import * as editProfilePage from './support/pages/EditProfile.po';
import { EditProfilePageData } from '../src/support/Base/pagedata/EditProfilePageData';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as logoutPage from './support/pages/Logout.po';

test.describe('Edit user profile test', () => {
	test('Edit user profile test', async () => {
		// IMPORTANT: this spec edits the *currently logged-in* user's own profile
		// (/#/pages/auth/profile) and then logs out + logs back in to prove the
		// saved credentials still authenticate. It therefore runs against the
		// SEEDED admin (admin@ever.co / admin from LoginPageData) — the prior
		// EditProfilePageData.email ('local.admin@ever.co') was never created in
		// the seed, so the very first login failed. We deliberately keep the email
		// and password UNCHANGED in the profile form so this shared-DB account's
		// credentials are not mutated for the specs that run after this one.
		await getPage().goto('/');
		await loginPage.verifyTitle();
		await loginPage.verifyLoginText();
		await loginPage.clearEmailField();
		await loginPage.enterEmail(LoginPageData.email);
		await loginPage.clearPasswordField();
		await loginPage.enterPassword(LoginPageData.password);
		await loginPage.clickLoginButton();
		await dashboardPage.verifyCreateButton();

		await test.step('Should be able to edit user profile info', async () => {
			// Login lands on a /#/pages/... route; a bare goto to another hash route is a
			// same-document no-op (the Angular hash router never re-renders), so force the
			// hash + settle before interacting with the profile form (mirrors gotoRoute).
			await getPage().goto('/#/pages/auth/profile');
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/auth/profile')) location.hash = '#/pages/auth/profile';
			});
			await getPage().waitForTimeout(800);

			await editProfilePage.firstNameInputVisible();
			await editProfilePage.lastNameInputVisible();
			await editProfilePage.passwordInputVisible();
			await editProfilePage.repeatPasswordInputVisible();
			await editProfilePage.emailInputVisible();
			await editProfilePage.languageSelectVisible();
			await editProfilePage.saveBtnExists();
			await editProfilePage.enterFirstNameData(EditProfilePageData.firstName);
			await editProfilePage.enterLastNameData(EditProfilePageData.lastName);
			// Re-set the SAME password so the account keeps logging in with LoginPageData.password.
			await editProfilePage.enterPasswordData(LoginPageData.password);
			await editProfilePage.enterRepeatPasswordData(LoginPageData.password);
			// Keep the SAME email so the account is not mutated for later specs.
			await editProfilePage.enterEmailData(LoginPageData.email);
			await editProfilePage.chooseLanguage(EditProfilePageData.preferredLanguage);
			await editProfilePage.saveBtnClick();
		});

		await test.step('Should be able to logout', async () => {
			await dashboardPage.clickUserName();
			await logoutPage.clickLogoutButton();
			await loginPage.verifyLoginText();
		});

		await test.step('Should be able to login with the same credentials', async () => {
			await loginPage.verifyLoginButton();
			await loginPage.clearEmailField();
			await loginPage.enterEmail(LoginPageData.email);
			await loginPage.clearPasswordField();
			await loginPage.enterPassword(LoginPageData.password);
			await loginPage.clickLoginButton();
			await dashboardPage.verifyCreateButton();
		});
	});
});
