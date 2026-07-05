import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as changeLanguagePage from './support/pages/ChangeLanguage.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { ChangeLanguagePageData } from '../src/support/Base/pagedata/ChangeLanguagePageData';
import { CustomCommands } from './support/commands';

test.describe('Change language test', () => {
	test('Change language test', async () => {
		// Scenario: Login with email
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		// Scenario: Verify settings bar
		await test.step('Should verify settings button and open Quick Settings', async () => {
			await changeLanguagePage.verifySettingsButtonVisible();
			await changeLanguagePage.clickSettingsButton();
			// Normalise back to English first: the preferred language is DB-persisted, so a prior run
			// could leave the account in another locale and skew the first assertion below.
			await changeLanguagePage.resetToEnglish(ChangeLanguagePageData.English);
		});

		// Scenario: Change language to Bulgarian
		await test.step('Should change language to Bulgarian', async () => {
			await changeLanguagePage.verifyLanguageSelectorVisible();
			await changeLanguagePage.clickLanguageSelector();
			await changeLanguagePage.verifyLanguageOptionsVisible();
			await changeLanguagePage.clickOnLanguageOption(ChangeLanguagePageData.codeBulgarian);
			await changeLanguagePage.verifyLanguageIsChanged(ChangeLanguagePageData.Bulgarian);
		});

		// Scenario: Change language to Russian
		await test.step('Should change language to Russian', async () => {
			await changeLanguagePage.verifyLanguageSelectorVisible();
			await changeLanguagePage.clickLanguageSelector();
			await changeLanguagePage.verifyLanguageOptionsVisible();
			await changeLanguagePage.clickOnLanguageOption(ChangeLanguagePageData.codeRussian);
			await changeLanguagePage.verifyLanguageIsChanged(ChangeLanguagePageData.Russian);
		});

		// Scenario: Change language to Hebrew
		await test.step('Should change language to Hebrew', async () => {
			await changeLanguagePage.verifyLanguageSelectorVisible();
			await changeLanguagePage.clickLanguageSelector();
			await changeLanguagePage.verifyLanguageOptionsVisible();
			await changeLanguagePage.clickOnLanguageOption(ChangeLanguagePageData.codeHebrew);
			await changeLanguagePage.verifyLanguageIsChanged(ChangeLanguagePageData.Hebrew);
		});

		// Scenario: Change language to English
		await test.step('Should change language to English', async () => {
			await changeLanguagePage.verifyLanguageSelectorVisible();
			await changeLanguagePage.clickLanguageSelector();
			await changeLanguagePage.verifyLanguageOptionsVisible();
			await changeLanguagePage.clickOnLanguageOption(ChangeLanguagePageData.codeEnglish);
			await changeLanguagePage.verifyLanguageIsChanged(ChangeLanguagePageData.English);
		});
	});
});
