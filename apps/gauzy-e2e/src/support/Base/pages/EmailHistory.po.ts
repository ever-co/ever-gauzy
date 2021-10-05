import {
	verifyElementIsVisible,
	clickButton,
	verifyText,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	clickButtonDouble
} from '../utils/util';
import { EmailHistoryPage } from '../pageobjects/EmailHistoryPageObject';

export const verifyHeaderText = (text) => {
	verifyText(EmailHistoryPage.headerTextCss, text);
};

export const filterButtonVisible = () => {
	verifyElementIsVisible(EmailHistoryPage.filterButtonCss);
};

export const clickFilterButton = () => {
	cy.intercept('GET', '/api/email-template*').as('waitTemplate');
	clickButton(EmailHistoryPage.filterButtonCss);
	cy.wait('@waitTemplate');
};

export const templatesDropdownVisible = () => {
	verifyElementIsVisible(EmailHistoryPage.emailTemplatesDropdownCss);
};

export const clickTemplatesDropdown = () => {
	clickButton(EmailHistoryPage.emailTemplatesDropdownCss);
};

export const verifyDropdownText = (text) => {
	verifyText(EmailHistoryPage.dropdownOptionCss, text);
};

export const selectOptionFromDropdown = (text) => {
	clickElementByText(EmailHistoryPage.dropdownOptionCss, text);
};

export const verifyBadgeExist = () => {
	verifyElementIsVisible(EmailHistoryPage.badgeCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(EmailHistoryPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(EmailHistoryPage.saveButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const clickTemplatesDropdownDouble = () => {
	clickButtonDouble(EmailHistoryPage.emailTemplatesDropdownCss);
};
