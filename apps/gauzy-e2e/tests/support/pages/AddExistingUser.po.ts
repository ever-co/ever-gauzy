import {
	verifyElementIsVisible,
	clickButton,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddExistingUserPage } from '../../../src/support/Base/pageobjects/AddExistingUserPageObject';

export const addExistingUsersButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.addUserButtonCss);
};

export const clickAddExistingUsersButton = async () => {
	// Called both on first load and again right after the remove-confirmation dialog closes +
	// the grid reloads (getUsers spinner). Settle the spinner and dispatch the click straight at
	// the element so a fading cdk-overlay backdrop from the closed dialog can't intercept it.
	await waitForSpinnerGone();
	await dispatchClick(AddExistingUserPage.addUserButtonCss);
};

export const tableBodyExists = async () => {
	await verifyElementIsVisible(AddExistingUserPage.selectTableRowCss);
};

export const clickTableRow = async (text: string) => {
	// Row click TOGGLES selection (selectUser sets disableButton = !isSelected). Let the grid finish
	// loading/settling first, then click the row ONCE — a rapid second click would deselect it and
	// re-disable the toolbar remove button.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
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
