import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickElementByText,
	clickElementIfVisible,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { EditUserPage } from '../pageobjects/EditUserPageObject';

export const gridButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.gridButtonCss);
};

export const clickGridButton = () => {
	clickButtonByIndex(EditUserPage.gridButtonCss, 0);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.editButtonCss);
};

export const clickEditButton = () => {
	clickButtonByIndex(EditUserPage.editButtonCss, 0);
};

export const firstNameInputVisible = () => {
	verifyElementIsVisible(EditUserPage.firstNameInputCss);
};

export const enterFirstNameData = (data) => {
	clearField(EditUserPage.firstNameInputCss);
	enterInput(EditUserPage.firstNameInputCss, data);
};

export const lastNameInputVisible = () => {
	verifyElementIsVisible(EditUserPage.lastNameInputCss);
};

export const enterLastNameData = (data) => {
	clearField(EditUserPage.lastNameInputCss);
	enterInput(EditUserPage.lastNameInputCss, data);
};

export const passwordInputVisible = () => {
	verifyElementIsVisible(EditUserPage.passwordInputCss);
};

export const enterPasswordData = (data) => {
	enterInput(EditUserPage.passwordInputCss, data);
};

export const repeatPasswordInputVisible = () => {
	verifyElementIsVisible(EditUserPage.repeatPasswordInputCss);
};

export const enterRepeatPasswordData = (data) => {
	enterInput(EditUserPage.repeatPasswordInputCss, data);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(EditUserPage.emailInputCss);
};

export const enterEmailData = (data) => {
	clearField(EditUserPage.emailInputCss);
	enterInput(EditUserPage.emailInputCss, data);
};

export const tagsMultyselectVisible = () => {
	verifyElementIsVisible(EditUserPage.tagsSelectCss);
};

export const clickTagsMultyselect = () => {
	clickButton(EditUserPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickElementIfVisible(EditUserPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const selectRoleVisible = () => {
	verifyElementIsVisible(EditUserPage.roleSelectCss);
};

export const chooseRoleSelectData = (data) => {
	clickButton(EditUserPage.roleSelectCss);
	clickElementByText(EditUserPage.roleSelectOptionCss, data);
};

export const languageSelectVisible = () => {
	verifyElementIsVisible(EditUserPage.preferredLanguageCss);
};

export const chooseLanguage = (data) => {
	clickButton(EditUserPage.preferredLanguageCss);
	clickElementByText(EditUserPage.preferredLanguageOptionCss, data);
};

export const saveBtnExists = () => {
	verifyElementIsVisible(EditUserPage.saveButtonCss);
};

export const saveBtnClick = () => {
	clickButton(EditUserPage.saveButtonCss);
};
