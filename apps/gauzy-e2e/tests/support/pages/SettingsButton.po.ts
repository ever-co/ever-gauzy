import {
	verifyText,
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clickElementByText,
	verifyClassExist,
	clickKeyboardBtnByKeycode
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SettingsButton } from '../../../src/support/Base/pageobjects/SettingsButtonPageObject';

export const verifySettingsButtonVisible = async () => {
	await verifyElementIsVisible(SettingsButton.settingsButtonCss);
};

export const clickSettingsButton = async () => {
	await clickButton(SettingsButton.settingsButtonCss);
};

export const clickThemesDropdown = async (index: number) => {
	await clickButtonByIndex(SettingsButton.dropdownButtonCss, index);
};

export const verifyTextExist = async (text: string) => {
	await verifyText(SettingsButton.dropdownOptionCss, text);
};

export const clickDropdownOption = async (text: string) => {
	await clickElementByText(SettingsButton.dropdownOptionCss, text);
};

export const verifyHeaderText = async (text: string) => {
	await verifyText(SettingsButton.verifyHeaderLangCss, text);
};

export const resetButtonVisible = async () => {
	await verifyElementIsVisible(SettingsButton.resetLayoutButtonCss);
};

export const verifyBodyTheme = async (someClass: string) => {
	await verifyClassExist(SettingsButton.bodyCss, someClass);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};
