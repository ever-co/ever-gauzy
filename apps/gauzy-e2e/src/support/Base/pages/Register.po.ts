import { clickButton, enterInput, verifyElementIsVisible } from '../utils/util';
import { RegisterPage } from '../pageobjects/RegisterPageObject';
import { RegisterPageData } from '../pagedata/RegisterPageData';

export const clickRegisterLink = () => {
	clickButton(RegisterPage.registerLinkCss);
};

export const enterFullName = (data) => {
	enterInput(RegisterPage.fullNameFieldCss, data);
};

export const enterEmail = (data) => {
	enterInput(RegisterPage.emailAddressFieldCss, data);
};

export const enterPassword = (data) => {
	enterInput(RegisterPage.passwordFieldCss, data);
};

export const enterConfirmPass = (data) => {
	enterInput(RegisterPage.confirmPassFieldCss, data);
};

export const verifyOrganisationNameField = () => {
	verifyElementIsVisible(RegisterPage.organisationNameFieldCss);
};

export const clickTermAndConditionCheckBox = () => {
	clickButton(RegisterPage.termAndConditionCheckboxCss);
};

export const clickRegisterButton = () => {
	clickButton(RegisterPage.registerButtonCss);
};
