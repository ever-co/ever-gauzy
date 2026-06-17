import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as settingsButton from './support/pages/SettingsButton.po';
import { SettingsButtonData } from '../src/support/Base/pagedata/SettingsButtonPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

// Quick Settings dropdown order (DOM): 0 = Language, 1 = Themes, 2 = Layout.
const LANGUAGE = 0;
const LAYOUT = 2;

test.describe('Settings button test', () => {
	test('Settings button test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should open Quick Settings and verify language options', async () => {
			await settingsButton.verifySettingsButtonVisible();
			await settingsButton.clickSettingsButton();
			await settingsButton.clickThemesDropdown(LANGUAGE);
			await settingsButton.verifyTextExist(SettingsButtonData.languageEnglish);
			await settingsButton.verifyTextExist(SettingsButtonData.languageBulgarian);
			await settingsButton.verifyTextExist(SettingsButtonData.languageHebrew);
			await settingsButton.verifyTextExist(SettingsButtonData.languageRussian);
			// Normalise the (DB-persisted) language back to English.
			await settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
			await settingsButton.verifyLanguageButtonText(
				SettingsButtonData.langButtonEnglish
			);
		});

		await test.step('Should verify layout options', async () => {
			await settingsButton.clickThemesDropdown(LAYOUT);
			await settingsButton.verifyTextExist(SettingsButtonData.layoutGrid);
			await settingsButton.verifyTextExist(SettingsButtonData.layoutTable);
			await settingsButton.clickKeyboardButtonByKeyCode(9);
			await settingsButton.resetButtonVisible();
		});

		await test.step('Should verify body light and dark themes via toggle', async () => {
			// Normalise to the light theme first (toggle is DB-persisted).
			const body = getPage().locator('body');
			const isDark = (await body.getAttribute('class'))?.includes(
				SettingsButtonData.darkTheme
			);
			if (isDark) {
				await settingsButton.clickLightDarkToggle();
			}
			await settingsButton.verifyBodyTheme(SettingsButtonData.lightTheme);
			await settingsButton.clickLightDarkToggle();
			await settingsButton.verifyBodyTheme(SettingsButtonData.darkTheme);
			await settingsButton.clickLightDarkToggle();
			await settingsButton.verifyBodyTheme(SettingsButtonData.lightTheme);
		});

		await test.step('Should switch to bulgarian language', async () => {
			await settingsButton.clickThemesDropdown(LANGUAGE);
			await settingsButton.clickDropdownOption(SettingsButtonData.languageBulgarian);
			await settingsButton.verifyLanguageButtonText(
				SettingsButtonData.langButtonBulgarian
			);
		});

		await test.step('Should switch to russian language', async () => {
			await settingsButton.clickThemesDropdown(LANGUAGE);
			await settingsButton.clickDropdownOption(SettingsButtonData.languageRussian);
			await settingsButton.verifyLanguageButtonText(
				SettingsButtonData.langButtonRussian
			);
		});

		await test.step('Should switch to hebrew language', async () => {
			await settingsButton.clickThemesDropdown(LANGUAGE);
			await settingsButton.clickDropdownOption(SettingsButtonData.languageHebrew);
			await settingsButton.verifyLanguageButtonText(
				SettingsButtonData.langButtonHebrew
			);
		});

		await test.step('Should switch back to english language', async () => {
			await settingsButton.clickThemesDropdown(LANGUAGE);
			await settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
			await settingsButton.verifyLanguageButtonText(
				SettingsButtonData.langButtonEnglish
			);
		});
	});
});
