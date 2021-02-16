import {
	verifyText,
	verifyStateByIndex,
	verifyElementIsVisible,
	clickButtonByIndex
} from '../utils/util';
import { SettingsFeaturesPage } from '../pageobjects/SettingsFeaturesPageObject';

export const tabButtonVisible = () => {
	verifyElementIsVisible(SettingsFeaturesPage.tabButtonCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(SettingsFeaturesPage.tabButtonCss, index);
};

export const verifyHeader = (text) => {
	verifyText(SettingsFeaturesPage.headerTextCss, text);
};

export const verifySubheader = (text) => {
	verifyText(SettingsFeaturesPage.subheaderTextCss, text);
};

export const verifyTextExist = (text) => {
	verifyText(SettingsFeaturesPage.textCss, text);
};

export const verifyMainTextExist = (text) => {
	verifyText(SettingsFeaturesPage.mainTextCss, text);
};

export const verifyCheckboxState = (index, state) => {
	verifyStateByIndex(SettingsFeaturesPage.checkboxCss, index, state);
};
