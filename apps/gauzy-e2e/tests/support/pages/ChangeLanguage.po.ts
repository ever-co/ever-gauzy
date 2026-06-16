import { verifyElementIsVisible, clickButton, clickButtonByIndex, verifyByText } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ChangeLanguage } from '../../../src/support/Base/pageobjects/ChangeLanguagePageObject';

export const verifySettingsButtonVisible = async () => {
	await verifyElementIsVisible(ChangeLanguage.settingsButtonCss);
};

export const clickSettingsButton = async () => {
	await clickButton(ChangeLanguage.settingsButtonCss);
};

export const verifyLanguageSelectorVisible = async () => {
	await verifyElementIsVisible(ChangeLanguage.languageDropdownCss);
};

export const clickLanguageSelector = async () => {
	await clickButton(ChangeLanguage.languageDropdownCss);
};

export const verifyLanguageOptionsVisible = async () => {
	await verifyElementIsVisible(ChangeLanguage.languageOptionsCss);
};

export const clickOnLanguageOption = async (index: number) => {
	await clickButtonByIndex(ChangeLanguage.languageOptionsCss, index);
};

export const verifyLanguageIsChanged = async (language: string) => {
	await verifyByText(ChangeLanguage.createButtonCss, language);
};
