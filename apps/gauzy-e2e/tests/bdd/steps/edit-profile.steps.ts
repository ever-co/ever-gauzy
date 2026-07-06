import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as loginPage from '../../support/pages/Login.po';
import * as editProfilePage from '../../support/pages/EditProfile.po';
import { EditProfilePageData } from '../../../src/support/Base/pagedata/EditProfilePageData';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import * as logoutPage from '../../support/pages/Logout.po';

// Converted 1:1 from the plain EditProfileTest.spec.ts: the single test() -> one Scenario. This spec does
// NOT use CustomCommands.login — it performs a MANUAL inline login as the seeded admin (before the first
// test.step), because the whole point of the test is to edit the currently-logged-in user's own profile
// and then log out + log back in to prove the saved credentials still authenticate. So that inline login
// is preserved verbatim as the first When step ("I log in to edit my profile") rather than replaced by the
// shared `Given I am logged in as the default user` Background — there is no Background here. The three
// test.step() blocks become the remaining When steps, each body the verbatim .po call sequence, so runtime
// behaviour is identical to the already-CI-tested spec.

When('I log in to edit my profile', async () => {
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
});

When('I edit my user profile info', async () => {
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

When('I log out from my profile', async () => {
	await dashboardPage.clickUserName();
	await logoutPage.clickLogoutButton();
	await loginPage.verifyLoginText();
});

When('I log in again with the same credentials', async () => {
	await loginPage.verifyLoginButton();
	await loginPage.clearEmailField();
	await loginPage.enterEmail(LoginPageData.email);
	await loginPage.clearPasswordField();
	await loginPage.enterPassword(LoginPageData.password);
	await loginPage.clickLoginButton();
	await dashboardPage.verifyCreateButton();
});
