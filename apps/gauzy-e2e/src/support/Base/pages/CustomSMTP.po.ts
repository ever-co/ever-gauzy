import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickElementByText
} from '../utils/util';
import { CustomSMTPPage } from '../pageobjects/CustomSMTPPageObject';

export const hostInputVisible = () => {
	verifyElementIsVisible(CustomSMTPPage.hostInputCss);
};

export const enterHostInputData = (data) => {
	clearField(CustomSMTPPage.hostInputCss);
	enterInput(CustomSMTPPage.hostInputCss, data);
};

export const portInputVisible = () => {
	verifyElementIsVisible(CustomSMTPPage.portInputCss);
};

export const enterPortInputData = (data) => {
	clearField(CustomSMTPPage.portInputCss);
	enterInput(CustomSMTPPage.portInputCss, data);
};

export const secureDropdownVisible = () => {
	verifyElementIsVisible(CustomSMTPPage.secureDropdownCss);
};

export const clickSecureDropdown = () => {
	clickButton(CustomSMTPPage.secureDropdownCss);
};

export const selectSecureOptionFromDropdown = (text) => {
	clickElementByText(CustomSMTPPage.dropdownOptionCss, text);
};

export const usernameInputVisible = () => {
	verifyElementIsVisible(CustomSMTPPage.usernameInputCss);
};

export const enterUsernameInputData = (data) => {
	clearField(CustomSMTPPage.usernameInputCss);
	enterInput(CustomSMTPPage.usernameInputCss, data);
};

export const passwordInputVisible = () => {
	verifyElementIsVisible(CustomSMTPPage.passwordInputCss);
};

export const enterPasswordInputData = (data) => {
	clearField(CustomSMTPPage.passwordInputCss);
	enterInput(CustomSMTPPage.passwordInputCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(CustomSMTPPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(CustomSMTPPage.saveButtonCss);
};
