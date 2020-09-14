import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex
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

export const clickTableRow = (index) => {
	clickButtonByIndex(RemoveUserPage.selectTableRowCss, index);
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
