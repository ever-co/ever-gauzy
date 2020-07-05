import {
	getTitle,
	clickButton,
	enterInput,
	clearField,
	verifyElementIsVisible
} from '../utils/util';
import { LoginPage } from '../pageobjects/LoginPageObject';
import { LoginPageData } from '../pagedata/LoginPageData';

export const clearEmailField = () => {
	clearField(LoginPage.emailInputFieldCss);
};
export const enterEmail = (data) => {
	enterInput(LoginPage.emailInputFieldCss, data);
};
export const verifyTitle = () => {
	getTitle().should('eq', LoginPageData.TitleText);
};
export const clearPasswordField = () => {
	clearField(LoginPage.passwordInputFieldCss);
};
export const enterPassword = (data) => {
	enterInput(LoginPage.passwordInputFieldCss, data);
};
export const clickLoginButton = () => {
	clickButton(LoginPage.loginButton);
};
export const verfyLoginText = () => {
	verifyElementIsVisible(LoginPage.loginHeadingCss);
};

export const verifyLoginButton = () => {
	verifyElementIsVisible(LoginPage.loginButton);
};
