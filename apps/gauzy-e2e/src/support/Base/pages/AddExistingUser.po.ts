import {
	verifyElementIsVisible,
	clickButton,
	clickKeyboardBtnByKeycode,
	clickElementIfVisible,
	clickElementByText,
	getLastElement
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

export const usersMultyselectVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.usersMultyselectCss);
};

export const clickUsersMultyselect = () => {
	clickButton(AddExistingUserPage.usersMultyselectCss);
};

export const selectUsersFromDropdown = (index) => {
	clickElementIfVisible(AddExistingUserPage.checkUsersMultyselectCss, index);
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

export const organizationDropdownVisible = () => {
	verifyElementIsVisible(AddExistingUserPage.organizationDropdownCss);
};

export const clickOrganizationDropdown = () => {
	clickButton(AddExistingUserPage.organizationDropdownCss);
};

export const selectOrganizationFromDropdown = () => {
	getLastElement(AddExistingUserPage.organizationDropdownOptionCss);
};
