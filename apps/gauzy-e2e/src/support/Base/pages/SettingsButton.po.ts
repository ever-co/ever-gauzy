import {
	verifyText,
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clickElementByText,
	verifyClassExist,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { SettingsButton } from '../pageobjects/SettingsButtonPageObject';

export const verifySettingsButtonVisible = () => {
	verifyElementIsVisible(SettingsButton.settingsButtonCss);
};

export const clickSettingsButton = () => {
	clickButton(SettingsButton.settingsButtonCss);
};

export const clickThemesDropdown = (index) => {
	clickButtonByIndex(SettingsButton.dropdownButtonCss, index);
};

export const verifyTextExist = (text) => {
	verifyText(SettingsButton.dropdownOptionCss, text);
};

export const clickDropdownOption = (text) => {
	clickElementByText(SettingsButton.dropdownOptionCss, text);
};

export const verifyHeaderText = (text) => {
	verifyText(SettingsButton.verifyHeaderLangCss, text);
};

export const resetButtonVisible = () => {
	verifyElementIsVisible(SettingsButton.resetLayoutButtonCss);
};

export const verifyBodyTheme = (someClass) => {
	verifyClassExist(SettingsButton.bodyCss, someClass);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};
