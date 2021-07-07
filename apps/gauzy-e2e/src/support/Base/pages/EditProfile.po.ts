import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	verifyValue,
	waitUntil
} from '../utils/util';
import { EditProfilePage } from '../pageobjects/EditProfilePageObject';

export const firstNameInputVisible = () => {
	waitUntil(3000);
	verifyElementIsVisible(EditProfilePage.firstNameInputCss);
};

export const enterFirstNameData = (data) => {
	clearField(EditProfilePage.firstNameInputCss);
	enterInput(EditProfilePage.firstNameInputCss, data);
};

export const lastNameInputVisible = () => {
	verifyElementIsVisible(EditProfilePage.lastNameInputCss);
};

export const enterLastNameData = (data) => {
	clearField(EditProfilePage.lastNameInputCss);
	enterInput(EditProfilePage.lastNameInputCss, data);
};

export const passwordInputVisible = () => {
	verifyElementIsVisible(EditProfilePage.passwordInputCss);
};

export const enterPasswordData = (data) => {
	enterInput(EditProfilePage.passwordInputCss, data);
};

export const repeatPasswordInputVisible = () => {
	verifyElementIsVisible(EditProfilePage.repeatPasswordInputCss);
};

export const enterRepeatPasswordData = (data) => {
	enterInput(EditProfilePage.repeatPasswordInputCss, data);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(EditProfilePage.emailInputCss);
};

export const enterEmailData = (data) => {
	clearField(EditProfilePage.emailInputCss);
	enterInput(EditProfilePage.emailInputCss, data);
};

export const languageSelectVisible = () => {
	verifyElementIsVisible(EditProfilePage.languageSelectCss);
};

export const chooseLanguage = (data) => {
	clickButton(EditProfilePage.languageSelectCss);
	clickElementByText(EditProfilePage.preferredLanguageOptionCss, data);
};

export const saveBtnExists = () => {
	verifyElementIsVisible(EditProfilePage.saveButtonCss);
};

export const saveBtnClick = () => {
	clickButton(EditProfilePage.saveButtonCss);
};

export const verifyFirstName = (val) => {
	verifyValue(EditProfilePage.firstNameInputCss, val);
};

export const verifyLastName = (val) => {
	verifyValue(EditProfilePage.lastNameInputCss, val);
};

export const verifyEmail = (val) => {
	verifyValue(EditProfilePage.emailInputCss, val);
};
