import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RemoveUserPage } from '../../../src/support/Base/pageobjects/RemoveUserPageObject';

export const gridButtonVisible = async () => {
	await verifyElementIsVisible(RemoveUserPage.gridButtonCss);
};

export const clickGridButton = async () => {
	await clickButtonByIndex(RemoveUserPage.gridButtonCss, 1);
};

export const tableBodyExists = async () => {
	await verifyElementIsVisible(RemoveUserPage.selectTableRowCss);
};

export const clickTableRow = async () => {
	await getLastElement(RemoveUserPage.selectTableRowCss);
};

export const removeButtonVisible = async () => {
	await verifyElementIsVisible(RemoveUserPage.removeButtonCss);
};

export const clickRemoveButton = async () => {
	await clickButton(RemoveUserPage.removeButtonCss);
};

export const confirmRemoveBtnVisible = async () => {
	await verifyElementIsVisible(RemoveUserPage.confirmRemoveUserButtonCss);
};

export const clickConfirmRemoveButton = async () => {
	await clickButton(RemoveUserPage.confirmRemoveUserButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(RemoveUserPage.toastrMessageCss);
};

export const verifyUserExists = async (text) => {
	await verifyText(RemoveUserPage.verifyUserCss, text);
};

export const verifyUserIsDeleted = async (text) => {
	await verifyTextNotExisting(RemoveUserPage.verifyUserCss, text);
};
