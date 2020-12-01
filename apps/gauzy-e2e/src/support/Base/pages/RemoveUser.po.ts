import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../utils/util';
import { RemoveUserPage } from '../pageobjects/RemoveUserPageObject';

export const gridButtonVisible = () => {
	verifyElementIsVisible(RemoveUserPage.gridButtonCss);
};

export const clickGridButton = () => {
	clickButtonByIndex(RemoveUserPage.gridButtonCss, 1);
};

export const tableBodyExists = () => {
	verifyElementIsVisible(RemoveUserPage.selectTableRowCss);
};

export const clickTableRow = () => {
	getLastElement(RemoveUserPage.selectTableRowCss);
};

export const removeButtonVisible = () => {
	verifyElementIsVisible(RemoveUserPage.removeButtonCss);
};

export const clickRemoveButton = () => {
	clickButton(RemoveUserPage.removeButtonCss);
};

export const confirmRemoveBtnVisible = () => {
	verifyElementIsVisible(RemoveUserPage.confirmRemoveUserButtonCss);
};

export const clickConfirmRemoveButton = () => {
	clickButton(RemoveUserPage.confirmRemoveUserButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(RemoveUserPage.toastrMessageCss);
};

export const verifyUserExists = (text) => {
	verifyText(RemoveUserPage.verifyUserCss, text);
};

export const verifyUserIsDeleted = (text) => {
	verifyTextNotExisting(RemoveUserPage.verifyUserCss, text);
};
