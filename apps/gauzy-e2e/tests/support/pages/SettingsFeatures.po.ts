import {
	verifyText,
	verifyStateByIndex,
	verifyElementIsVisible,
	clickButtonByIndex
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SettingsFeaturesPage } from '../../../src/support/Base/pageobjects/SettingsFeaturesPageObject';

export const tabButtonVisible = async () => {
	await verifyElementIsVisible(SettingsFeaturesPage.tabButtonCss);
};

export const clickTabButton = async (index: number) => {
	await clickButtonByIndex(SettingsFeaturesPage.tabButtonCss, index);
};

export const verifyHeader = async (text: string) => {
	await verifyText(SettingsFeaturesPage.headerTextCss, text);
};

export const verifySubheader = async (text: string) => {
	await verifyText(SettingsFeaturesPage.subheaderTextCss, text);
};

export const verifyTextExist = async (text: string) => {
	await verifyText(SettingsFeaturesPage.textCss, text);
};

export const verifyMainTextExist = async (text: string) => {
	await verifyText(SettingsFeaturesPage.mainTextCss, text);
};

export const verifyCheckboxState = async (index: number, state: string) => {
	await verifyStateByIndex(SettingsFeaturesPage.checkboxCss, index, state);
};
