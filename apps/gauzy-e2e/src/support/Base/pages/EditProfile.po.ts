import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField
} from '../utils/util';
import { EditProfilePage } from '../pageobjects/EditProfilePageObject';

export const firstNameInputVisible = () => {
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
	verifyElementIsVisible(EditProfilePage.emailInpitCss);
};

export const enterEmailData = (data) => {
	clearField(EditProfilePage.emailInpitCss);
	enterInput(EditProfilePage.emailInpitCss, data);
};

export const languageSelectVisible = () => {
	verifyElementIsVisible(EditProfilePage.preferredLanguageCss);
};

export const chooseLanguage = (data) => {
	clickButton(EditProfilePage.preferredLanguageCss);
	clickElementByText(EditProfilePage.preferredLanguageOptionCss, data);
};

export const saveBtnExists = () => {
	verifyElementIsVisible(EditProfilePage.saveButtonCss);
};

export const saveBtnClick = () => {
	clickButton(EditProfilePage.saveButtonCss);
};
