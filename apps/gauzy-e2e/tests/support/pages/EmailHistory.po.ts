import {
	verifyElementIsVisible,
	clickButton,
	verifyText,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	clickButtonDouble
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EmailHistoryPage } from '../../../src/support/Base/pageobjects/EmailHistoryPageObject';

export const verifyHeaderText = async (text: string) => {
	await verifyText(EmailHistoryPage.headerTextCss, text);
};

export const filterButtonVisible = async () => {
	await verifyElementIsVisible(EmailHistoryPage.filterButtonCss);
};

export const clickFilterButton = async () => {
	await clickButton(EmailHistoryPage.filterButtonCss);
};

export const templatesDropdownVisible = async () => {
	await verifyElementIsVisible(EmailHistoryPage.emailTemplatesDropdownCss);
};

export const clickTemplatesDropdown = async () => {
	await clickButton(EmailHistoryPage.emailTemplatesDropdownCss);
};

export const verifyDropdownText = async (text: string) => {
	await verifyText(EmailHistoryPage.dropdownOptionCss, text);
};

export const selectOptionFromDropdown = async (text: string) => {
	await clickElementByText(EmailHistoryPage.dropdownOptionCss, text);
};

export const verifyBadgeExist = async () => {
	await verifyElementIsVisible(EmailHistoryPage.badgeCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(EmailHistoryPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(EmailHistoryPage.saveButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickTemplatesDropdownDouble = async () => {
	await clickButtonDouble(EmailHistoryPage.emailTemplatesDropdownCss);
};
