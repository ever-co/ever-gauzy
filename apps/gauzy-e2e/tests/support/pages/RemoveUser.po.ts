import {
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	clickButtonByIndex,
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	clickByText,
	verifyElementNotExist
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RemoveUserPage } from '../../../src/support/Base/pageobjects/RemoveUserPageObject';

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const tableBodyExists = async () => {
	await verifyElementIsVisibleByIndex(RemoveUserPage.selectTableRowCss, 0);
};

export const clickTableRow = async (text: string) => {
	await clickByText(RemoveUserPage.selectTableRowCss, text);
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
	await verifyElementNotExist(`${RemoveUserPage.verifyUserCss}:has-text("${text}")`);
};
