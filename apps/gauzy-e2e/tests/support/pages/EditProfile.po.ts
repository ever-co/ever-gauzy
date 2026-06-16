import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	verifyValue,
	waitUntil
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EditProfilePage } from '../../../src/support/Base/pageobjects/EditProfilePageObject';

export const firstNameInputVisible = async () => {
	await waitUntil(3000);
	await verifyElementIsVisible(EditProfilePage.firstNameInputCss);
};

export const enterFirstNameData = async (data: string) => {
	await clearField(EditProfilePage.firstNameInputCss);
	await enterInput(EditProfilePage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.lastNameInputCss);
};

export const enterLastNameData = async (data: string) => {
	await clearField(EditProfilePage.lastNameInputCss);
	await enterInput(EditProfilePage.lastNameInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.passwordInputCss);
};

export const enterPasswordData = async (data: string) => {
	await enterInput(EditProfilePage.passwordInputCss, data);
};

export const repeatPasswordInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.repeatPasswordInputCss);
};

export const enterRepeatPasswordData = async (data: string) => {
	await enterInput(EditProfilePage.repeatPasswordInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await clearField(EditProfilePage.emailInputCss);
	await enterInput(EditProfilePage.emailInputCss, data);
};

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.languageSelectCss);
};

export const chooseLanguage = async (data: string) => {
	await clickButton(EditProfilePage.languageSelectCss);
	await clickElementByText(EditProfilePage.preferredLanguageOptionCss, data);
};

export const saveBtnExists = async () => {
	await verifyElementIsVisible(EditProfilePage.saveButtonCss);
};

export const saveBtnClick = async () => {
	await clickButton(EditProfilePage.saveButtonCss);
};

export const verifyFirstName = async (val: string) => {
	await verifyValue(EditProfilePage.firstNameInputCss, val);
};

export const verifyLastName = async (val: string) => {
	await verifyValue(EditProfilePage.lastNameInputCss, val);
};

export const verifyEmail = async (val: string) => {
	await verifyValue(EditProfilePage.emailInputCss, val);
};
