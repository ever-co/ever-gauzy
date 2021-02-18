import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as settingsButton from '../support/Base/pages/SettingsButton.po';
import { SettingsButtonData } from '../support/Base/pagedata/SettingsButtonPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Settings button test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to verify themes', () => {
		settingsButton.verifySettingsButtonVisible();
		settingsButton.clickSettingsButton();
		settingsButton.clickThemesDropdown(1);
		settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
		settingsButton.clickThemesDropdown(0);
		settingsButton.verifyTextExist(SettingsButtonData.themeButtonLight);
		settingsButton.verifyTextExist(SettingsButtonData.themeButtonDark);
		settingsButton.verifyTextExist(SettingsButtonData.themeButtonCosmic);
		settingsButton.verifyTextExist(SettingsButtonData.themeButtonCorporate);
		settingsButton.clickKeyboardButtonByKeyCode(9);
	});
	it('Should be able to verify languages', () => {
		settingsButton.clickThemesDropdown(1);
		settingsButton.verifyTextExist(SettingsButtonData.languageEnglish);
		settingsButton.verifyTextExist(SettingsButtonData.languageBulgarian);
		settingsButton.verifyTextExist(SettingsButtonData.languageHebrew);
		settingsButton.verifyTextExist(SettingsButtonData.languageRussian);
		settingsButton.clickKeyboardButtonByKeyCode(9);
	});
	it('Should be able to verify layout', () => {
		settingsButton.clickThemesDropdown(2);
		settingsButton.verifyTextExist(SettingsButtonData.layoutGrid);
		settingsButton.verifyTextExist(SettingsButtonData.layoutTable);
		settingsButton.verifyTextExist(SettingsButtonData.layoutSprint);
		settingsButton.clickKeyboardButtonByKeyCode(9);
		settingsButton.resetButtonVisible();
	});
	it('Should be able to verify body light theme', () => {
		settingsButton.clickThemesDropdown(0);
		settingsButton.clickDropdownOption(SettingsButtonData.themeButtonLight);
		settingsButton.verifyBodyTheme(SettingsButtonData.lightTheme);
	});
	it('Should be able to verify body dark theme', () => {
		settingsButton.clickThemesDropdown(0);
		settingsButton.clickDropdownOption(SettingsButtonData.themeButtonDark);
		settingsButton.verifyBodyTheme(SettingsButtonData.darkTheme);
	});
	it('Should be able to verify body cosmic theme', () => {
		settingsButton.clickThemesDropdown(0);
		settingsButton.clickDropdownOption(
			SettingsButtonData.themeButtonCosmic
		);
		settingsButton.verifyBodyTheme(SettingsButtonData.cosmicTheme);
	});
	it('Should be able to verify body corporate theme', () => {
		settingsButton.clickThemesDropdown(0);
		settingsButton.clickDropdownOption(
			SettingsButtonData.themeButtonCorporate
		);
		settingsButton.verifyBodyTheme(SettingsButtonData.corporateTheme);
	});
	it('Should be able to verify english header', () => {
		settingsButton.clickThemesDropdown(1);
		settingsButton.clickDropdownOption(SettingsButtonData.languageEnglish);
		settingsButton.verifyHeaderText(SettingsButtonData.headerEnglish);
	});
	it('Should be able to verify bulgarian header', () => {
		settingsButton.clickThemesDropdown(1);
		settingsButton.clickDropdownOption(
			SettingsButtonData.languageBulgarian
		);
		settingsButton.verifyHeaderText(SettingsButtonData.headerBulgarian);
	});
	it('Should be able to verify russian header', () => {
		settingsButton.clickThemesDropdown(1);
		settingsButton.clickDropdownOption(
			SettingsButtonData.changeLangRussian
		);
		settingsButton.verifyHeaderText(SettingsButtonData.headerRussian);
	});
	it('Should be able to verify hebrew header', () => {
		settingsButton.clickThemesDropdown(1);
		settingsButton.clickDropdownOption(SettingsButtonData.changeLangHebrew);
		settingsButton.verifyHeaderText(SettingsButtonData.headerHebrew);
	});
});
