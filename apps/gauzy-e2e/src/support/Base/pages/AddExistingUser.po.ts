import {
	verifyElementIsVisible,
	clickButton,
	clickKeyboardBtnByKeycode,
	clickElementByText
} from '../utils/util';
import { AddExistingUserPage } from '../pageobjects/AddExistingUserPageObject';

export const addExistingUsersButtonVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.addUserButtonCss);
};

export const clickAddExistingUsersButton = () => {
	clickButton(AddExistingUserPage.addUserButtonCss);
};

export const tableBodyExists = () => {
	verifyElementIsVisible(AddExistingUserPage.selectTableRowCss);
};

export const clickTableRow = (text) => {
	clickElementByText(AddExistingUserPage.selectTableRowCss, text);
};

export const removeUserButtonVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.removeUserButtonCss);
};

export const clickRemoveUserButton = () => {
	clickButton(AddExistingUserPage.removeUserButtonCss);
};

export const confirmRemoveUserBtnVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.confirmRemoveUserButtonCss);
};

export const clickConfirmRemoveUserBtn = () => {
	clickButton(AddExistingUserPage.confirmRemoveUserButtonCss);
};

export const usersMultiSelectVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.usersMultiSelectCss);
};

export const clickUsersMultiSelect = () => {
	clickButton(AddExistingUserPage.usersMultiSelectCss);
};

export const selectUsersFromDropdown = (text) => {
	clickElementByText(AddExistingUserPage.checkUsersMultiSelectCss, text);
};

export const cancelButtonVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickCancelButton = () => {
	clickButton(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveUsersButtonVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.saveSelectedUsersButtonCss);
};

export const clickSaveUsersButton = () => {
	clickButton(AddExistingUserPage.saveSelectedUsersButtonCss);
};
