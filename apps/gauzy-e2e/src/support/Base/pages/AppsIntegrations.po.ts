import {
	verifyText,
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { AppsIntegrationsPage } from '../pageobjects/AppsIntegrationsPageObject';

export const verifyHeaderText = (text) => {
	verifyText(AppsIntegrationsPage.verifyHeaderCss, text);
};

export const dropdownVisible = () => {
	verifyElementIsVisible(AppsIntegrationsPage.dropdownCss);
};

export const clickDropdown = (index) => {
	clickButtonByIndex(AppsIntegrationsPage.dropdownCss, index);
};

export const verifyDropdownText = (text) => {
	verifyText(AppsIntegrationsPage.dropdownOptionCss, text);
};

export const verifySearchInputVisible = () => {
	verifyElementIsVisible(AppsIntegrationsPage.searchInputCss);
};

export const clearButtonVisible = () => {
	verifyElementIsVisible(AppsIntegrationsPage.clearAllButtonCss);
};

export const verifyCardHeaderText = (text) => {
	verifyText(AppsIntegrationsPage.verifyCardHeaderCss, text);
};

export const verifyIntegrationList = () => {
	verifyElementIsVisible(AppsIntegrationsPage.integrationCss);
};

export const clickIntegrationItem = (index) => {
	clickButtonByIndex(AppsIntegrationsPage.integrationCss, index);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(AppsIntegrationsPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(AppsIntegrationsPage.backButtonCss);
};

export const clientIdInputVisible = () => {
	verifyElementIsVisible(AppsIntegrationsPage.hubstaffClientIdInputCss);
};

export const apiKeyInputVisible = () => {
	verifyElementIsVisible(AppsIntegrationsPage.upworkApiKeyInputCss);
};

export const secretInputVisible = () => {
	verifyElementIsVisible(AppsIntegrationsPage.upworkSecretInputCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};
