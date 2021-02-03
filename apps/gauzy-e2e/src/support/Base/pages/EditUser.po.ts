import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickElementByText,
	clickElementIfVisible,
	clickKeyboardBtnByKeycode,
	verifyText,
	waitElementToHide,
	clickTableRowByText
} from '../utils/util';
import { EditUserPage } from '../pageobjects/EditUserPageObject';

export const gridButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.gridButtonCss);
};

export const clickGridButton = () => {
	clickButtonByIndex(EditUserPage.gridButtonCss, 1);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(EditUserPage.selectTableRowCss);
};

export const selectTableRow = (text) => {
	clickTableRowByText(EditUserPage.selectTableRowCss, text);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.editButtonCss);
};

export const clickEditButton = () => {
	clickButtonByIndex(EditUserPage.editButtonCss, 0);
};

export const orgTabButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.orgTabButtonCss);
};

export const clickOrgTabButton = (index) => {
	clickButtonByIndex(EditUserPage.orgTabButtonCss, index);
};

export const removeOrgButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.removeOrgButtonCss);
};

export const clickRemoveOrgButton = () => {
	clickButtonByIndex(EditUserPage.removeOrgButtonCss, 0);
};

export const confirmRemoveBtnVisible = () => {
	verifyElementIsVisible(EditUserPage.confirmRemoveOrgButtonCss);
};

export const clickConfirmRemoveButton = () => {
	clickButton(EditUserPage.confirmRemoveOrgButtonCss);
};

export const addOrgButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.addOrgButtonCss);
};

export const clickAddOrgButton = () => {
	clickButton(EditUserPage.addOrgButtonCss);
};

export const selectOrgDropdownVisible = () => {
	verifyElementIsVisible(EditUserPage.selectOrgMultyselectCss);
};

export const clickSelectOrgDropdown = () => {
	clickButton(EditUserPage.selectOrgMultyselectCss);
};

export const clickSelectOrgDropdownOption = () => {
	clickElementIfVisible(EditUserPage.selectOrgDropdownOptionCss, 0);
};

export const saveSelectedOrgButtonVisible = () => {
	verifyElementIsVisible(EditUserPage.saveSelectedOrgButton);
};

export const clickSaveselectedOrgButton = () => {
	clickButton(EditUserPage.saveSelectedOrgButton);
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
	clickButtonByIndex(EditUserPage.tagsSelectOptionCss, index);
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

export const verifyUserExists = (text) => {
	verifyText(EditUserPage.verifyUserCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(EditUserPage.toastrMessageCss);
};
