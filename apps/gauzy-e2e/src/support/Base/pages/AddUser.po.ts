import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField
} from '../utils/util';
import { AddUserPage } from '../pageobjects/AddUserPageObject';

export const addUserButtonVisible = () => {
	verifyElementIsVisible(AddUserPage.addUserButtonCss);
};

export const clickAddUserButton = () => {
	clickButton(AddUserPage.addUserButtonCss);
};

export const firstNameInputVisible = () => {
	verifyElementIsVisible(AddUserPage.firstNameInputCss);
};

export const enterFirstNameData = (data) => {
	clearField(AddUserPage.firstNameInputCss);
	enterInput(AddUserPage.firstNameInputCss, data);
};

export const lastNameInputVisible = () => {
	verifyElementIsVisible(AddUserPage.lastNameInputCss);
};

export const enterLastNameData = (data) => {
	clearField(AddUserPage.lastNameInputCss);
	enterInput(AddUserPage.lastNameInputCss, data);
};

export const usernameInputVisible = () => {
	verifyElementIsVisible(AddUserPage.usernameInputCss);
};

export const enterUsernameData = (data) => {
	clearField(AddUserPage.usernameInputCss);
	enterInput(AddUserPage.usernameInputCss, data);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(AddUserPage.emailInputCss);
};

export const enterEmailData = (data) => {
	clearField(AddUserPage.emailInputCss);
	enterInput(AddUserPage.emailInputCss, data);
};

export const selectUserRoleVisible = () => {
	verifyElementIsVisible(AddUserPage.selectRoleDropdownCss);
};

export const selectUserRoleData = (data) => {
	clickButton(AddUserPage.selectRoleDropdownCss);
	clickElementByText(AddUserPage.selectRoleDropdownOptionCss, data);
};

export const passwordInputVisible = () => {
	verifyElementIsVisible(AddUserPage.passwordInputCss);
};

export const enterPasswordInputData = (data) => {
	clearField(AddUserPage.passwordInputCss);
	enterInput(AddUserPage.passwordInputCss, data);
};

export const imageInputVisible = () => {
	verifyElementIsVisible(AddUserPage.imageInputUrlCss);
};

export const enterImageDataUrl = (url) => {
	clearField(AddUserPage.imageInputUrlCss);
	enterInput(AddUserPage.imageInputUrlCss, url);
};

export const confirmAddButtonVisible = () => {
	verifyElementIsVisible(AddUserPage.confirmAddUserButtonCss);
};

export const clickConfirmAddButton = () => {
	clickButton(AddUserPage.confirmAddUserButtonCss);
};
