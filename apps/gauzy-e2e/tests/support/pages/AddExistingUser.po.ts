import {
	verifyElementIsVisible,
	clickButton,
	clickKeyboardBtnByKeycode,
	clickElementByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddExistingUserPage } from '../../../src/support/Base/pageobjects/AddExistingUserPageObject';

export const addExistingUsersButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.addUserButtonCss);
};

export const clickAddExistingUsersButton = async () => {
	await clickButton(AddExistingUserPage.addUserButtonCss);
};

export const tableBodyExists = async () => {
	await verifyElementIsVisible(AddExistingUserPage.selectTableRowCss);
};

export const clickTableRow = async (text: string) => {
	await clickElementByText(AddExistingUserPage.selectTableRowCss, text);
};

export const removeUserButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.removeUserButtonCss);
};

export const clickRemoveUserButton = async () => {
	await clickButton(AddExistingUserPage.removeUserButtonCss);
};

export const confirmRemoveUserBtnVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.confirmRemoveUserButtonCss);
};

export const clickConfirmRemoveUserBtn = async () => {
	await clickButton(AddExistingUserPage.confirmRemoveUserButtonCss);
};

export const usersMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.usersMultiSelectCss);
};

export const clickUsersMultiSelect = async () => {
	await clickButton(AddExistingUserPage.usersMultiSelectCss);
};

export const selectUsersFromDropdown = async (text: string) => {
	await clickElementByText(AddExistingUserPage.checkUsersMultiSelectCss, text);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickCancelButton = async () => {
	await clickButton(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveUsersButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.saveSelectedUsersButtonCss);
};

export const clickSaveUsersButton = async () => {
	await clickButton(AddExistingUserPage.saveSelectedUsersButtonCss);
};
