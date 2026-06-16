import {
	verifyText,
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clickKeyboardBtnByKeycode
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AppsIntegrationsPage } from '../../../src/support/Base/pageobjects/AppsIntegrationsPageObject';

export const verifyHeaderText = async (text) => {
	await verifyText(AppsIntegrationsPage.verifyHeaderCss, text);
};

export const dropdownVisible = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.dropdownCss);
};

export const clickDropdown = async (index) => {
	await clickButtonByIndex(AppsIntegrationsPage.dropdownCss, index);
};

export const verifyDropdownText = async (text) => {
	await verifyText(AppsIntegrationsPage.dropdownOptionCss, text);
};

export const verifySearchInputVisible = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.searchInputCss);
};

export const clearButtonVisible = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.clearAllButtonCss);
};

export const verifyCardHeaderText = async (text) => {
	await verifyText(AppsIntegrationsPage.verifyCardHeaderCss, text);
};

export const verifyIntegrationList = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.integrationCss);
};

export const clickIntegrationItem = async (index) => {
	await clickButtonByIndex(AppsIntegrationsPage.integrationCss, index);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(AppsIntegrationsPage.backButtonCss);
};

export const clientIdInputVisible = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.hubstaffClientIdInputCss);
};

export const apiKeyInputVisible = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.upworkApiKeyInputCss);
};

export const secretInputVisible = async () => {
	await verifyElementIsVisible(AppsIntegrationsPage.upworkSecretInputCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};
