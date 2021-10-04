import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyElementNotExist,
    verifyByText
} from '../utils/util';
import { ChangeLanguage } from '../pageobjects/ChangeLanguagePageObject';


export const verifySettingsButtonVisible = () => {
    verifyElementIsVisible(ChangeLanguage.settingsButtonCss);
};
export const clickSettingsButton = () => {
    clickButton(ChangeLanguage.settingsButtonCss);
};

export const verifyLanguageSelectorVisible = () => {
    verifyElementIsVisible(ChangeLanguage.languageDropdownCss);
};

export const clickLanguageSelector = () => {
    clickButton(ChangeLanguage.languageDropdownCss)
};

export const verifyLanguageOptionsVisible = () => {
    verifyElementIsVisible(ChangeLanguage.languageOptionsCss);
};

export const clickOnLanguageOption = (index: number) => {
    clickButtonByIndex(ChangeLanguage.languageOptionsCss, index)
};

export const verifyLanguageIsChanged = (language: string) => {
    verifyByText(ChangeLanguage.createButtonCss, language);
};