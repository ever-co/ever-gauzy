import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	verifyText,
	waitElementToHide,
	waitUntil
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddUserPage } from '../../../src/support/Base/pageobjects/AddUserPageObject';

export const addUserButtonVisible = async () => {
	await verifyElementIsVisible(AddUserPage.addUserButtonCss);
};

export const clickAddUserButton = async () => {
	await clickButton(AddUserPage.addUserButtonCss);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.firstNameInputCss);
};

export const enterFirstNameData = async (data) => {
	await clearField(AddUserPage.firstNameInputCss);
	await enterInput(AddUserPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.lastNameInputCss);
};

export const enterLastNameData = async (data) => {
	await clearField(AddUserPage.lastNameInputCss);
	await enterInput(AddUserPage.lastNameInputCss, data);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.usernameInputCss);
};

export const enterUsernameData = async (data) => {
	await clearField(AddUserPage.usernameInputCss);
	await enterInput(AddUserPage.usernameInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.emailInputCss);
};

export const enterEmailData = async (data) => {
	await clearField(AddUserPage.emailInputCss);
	await enterInput(AddUserPage.emailInputCss, data);
};

export const selectUserRoleVisible = async () => {
	await verifyElementIsVisible(AddUserPage.selectRoleDropdownCss);
};

export const selectUserRoleData = async (data) => {
	await clickButton(AddUserPage.selectRoleDropdownCss);
	await clickElementByText(AddUserPage.selectRoleDropdownOptionCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.passwordInputCss);
};

export const enterPasswordInputData = async (data) => {
	await clearField(AddUserPage.passwordInputCss);
	await enterInput(AddUserPage.passwordInputCss, data);
};

export const imageInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.imageInputUrlCss);
};

export const enterImageDataUrl = async (url) => {
	await clearField(AddUserPage.imageInputUrlCss);
	await enterInput(AddUserPage.imageInputUrlCss, url);
};

export const confirmAddButtonVisible = async () => {
	await verifyElementIsVisible(AddUserPage.confirmAddUserButtonCss);
};

export const clickConfirmAddButton = async () => {
	await clickButton(AddUserPage.confirmAddUserButtonCss);
};

export const verifyUserExists = async (text) => {
	await waitUntil(3000);
	await verifyText(AddUserPage.verifyUserCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddUserPage.toastrMessageCss);
};

export const goToEndOfUserList = async () => {
	await clickButton(AddUserPage.endOfUserListCss);
};
