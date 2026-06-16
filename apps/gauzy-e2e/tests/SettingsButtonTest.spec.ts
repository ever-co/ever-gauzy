import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as settingsButton from './support/pages/SettingsButton.po';
import { SettingsButtonData } from '../src/support/Base/pagedata/SettingsButtonPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Settings button test', () => {
	test('Settings button test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify themes', async () => {
			await settingsButton.verifySettingsButtonVisible();
			await settingsButton.clickSettingsButton();
			await settingsButton.clickThemesDropdown(1);
			await settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
			await settingsButton.clickThemesDropdown(0);
			await settingsButton.verifyTextExist(SettingsButtonData.themeButtonLight);
			await settingsButton.verifyTextExist(SettingsButtonData.themeButtonDark);
			await settingsButton.verifyTextExist(SettingsButtonData.themeButtonCosmic);
			await settingsButton.verifyTextExist(SettingsButtonData.themeButtonCorporate);
			await settingsButton.clickKeyboardButtonByKeyCode(9);
		});

		await test.step('Should be able to verify languages', async () => {
			await settingsButton.clickThemesDropdown(1);
			await settingsButton.verifyTextExist(SettingsButtonData.languageEnglish);
			await settingsButton.verifyTextExist(SettingsButtonData.languageBulgarian);
			await settingsButton.verifyTextExist(SettingsButtonData.languageHebrew);
			await settingsButton.verifyTextExist(SettingsButtonData.languageRussian);
			await settingsButton.clickKeyboardButtonByKeyCode(9);
		});

		await test.step('Should be able to verify layout', async () => {
			await settingsButton.clickThemesDropdown(2);
			await settingsButton.verifyTextExist(SettingsButtonData.layoutGrid);
			await settingsButton.verifyTextExist(SettingsButtonData.layoutTable);
			await settingsButton.verifyTextExist(SettingsButtonData.layoutSprint);
			await settingsButton.clickKeyboardButtonByKeyCode(9);
			await settingsButton.resetButtonVisible();
		});

		await test.step('Should be able to verify body light theme', async () => {
			await settingsButton.clickThemesDropdown(0);
			await settingsButton.clickDropdownOption(SettingsButtonData.themeButtonLight);
			await settingsButton.verifyBodyTheme(SettingsButtonData.lightTheme);
		});

		await test.step('Should be able to verify body dark theme', async () => {
			await settingsButton.clickThemesDropdown(0);
			await settingsButton.clickDropdownOption(SettingsButtonData.themeButtonDark);
			await settingsButton.verifyBodyTheme(SettingsButtonData.darkTheme);
		});

		await test.step('Should be able to verify body cosmic theme', async () => {
			await settingsButton.clickThemesDropdown(0);
			await settingsButton.clickDropdownOption(
				SettingsButtonData.themeButtonCosmic
			);
			await settingsButton.verifyBodyTheme(SettingsButtonData.cosmicTheme);
		});

		await test.step('Should be able to verify body corporate theme', async () => {
			await settingsButton.clickThemesDropdown(0);
			await settingsButton.clickDropdownOption(
				SettingsButtonData.themeButtonCorporate
			);
			await settingsButton.verifyBodyTheme(SettingsButtonData.corporateTheme);
		});

		await test.step('Should be able to verify english header', async () => {
			await settingsButton.clickThemesDropdown(1);
			await settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
			await settingsButton.verifyHeaderText(SettingsButtonData.headerEnglish);
		});

		await test.step('Should be able to verify bulgarian header', async () => {
			await settingsButton.clickThemesDropdown(1);
			await settingsButton.clickDropdownOption(
				SettingsButtonData.languageBulgarian
			);
			await settingsButton.verifyHeaderText(SettingsButtonData.headerBulgarian);
		});

		await test.step('Should be able to verify russian header', async () => {
			await settingsButton.clickThemesDropdown(1);
			await settingsButton.clickDropdownOption(
				SettingsButtonData.changeLangRussian
			);
			await settingsButton.verifyHeaderText(SettingsButtonData.headerRussian);
		});

		await test.step('Should be able to verify hebrew header', async () => {
			await settingsButton.clickThemesDropdown(1);
			await settingsButton.clickDropdownOption(SettingsButtonData.changeLangHebrew);
			await settingsButton.verifyHeaderText(SettingsButtonData.headerHebrew);
		});
	});
});
