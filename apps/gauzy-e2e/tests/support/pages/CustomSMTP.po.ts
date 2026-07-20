import { verifyElementIsVisible, clickButton, clearField, enterInput, clickElementByText } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { CustomSMTPPage } from '../../../src/support/Base/pageobjects/CustomSMTPPageObject';

export const hostInputVisible = async () => {
	await verifyElementIsVisible(CustomSMTPPage.hostInputCss);
};

export const enterHostInputData = async (data: string) => {
	await clearField(CustomSMTPPage.hostInputCss);
	await enterInput(CustomSMTPPage.hostInputCss, data);
};

export const portInputVisible = async () => {
	await verifyElementIsVisible(CustomSMTPPage.portInputCss);
};

export const enterPortInputData = async (data: string) => {
	await clearField(CustomSMTPPage.portInputCss);
	await enterInput(CustomSMTPPage.portInputCss, data);
};

export const secureDropdownVisible = async () => {
	await verifyElementIsVisible(CustomSMTPPage.secureDropdownCss);
};

export const clickSecureDropdown = async () => {
	await clickButton(CustomSMTPPage.secureDropdownCss);
};

export const selectSecureOptionFromDropdown = async (text: string) => {
	await clickElementByText(CustomSMTPPage.dropdownOptionCss, text);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(CustomSMTPPage.usernameInputCss);
};

export const enterUsernameInputData = async (data: string) => {
	await clearField(CustomSMTPPage.usernameInputCss);
	await enterInput(CustomSMTPPage.usernameInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(CustomSMTPPage.passwordInputCss);
};

export const enterPasswordInputData = async (data: string) => {
	await clearField(CustomSMTPPage.passwordInputCss);
	await enterInput(CustomSMTPPage.passwordInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(CustomSMTPPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(CustomSMTPPage.saveButtonCss);
};
