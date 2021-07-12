import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	verifyText,
	clickButtonByIndex
} from '../utils/util';
import { DangerZonePage } from '../pageobjects/DangerZonePageObject';

export const verifyHeaderTextExist = (text) => {
	verifyText(DangerZonePage.headerTextCss, text);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(DangerZonePage.deleteButtonCss);
};

export const clickDeleteButton = (index) => {
	clickButtonByIndex(DangerZonePage.deleteButtonCss, index);
};

export const verifyDeleteTextExist = (text) => {
	verifyText(DangerZonePage.confirmDeleteTextCss, text);
};

export const deleteInputVisible = () => {
	verifyElementIsVisible(DangerZonePage.inputCss);
};

export const enterInputData = (data) => {
	clearField(DangerZonePage.inputCss);
	enterInput(DangerZonePage.inputCss, data);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(DangerZonePage.confirmDeleteButtonCss);
};

export const cancelButtonVisible = () => {
	verifyElementIsVisible(DangerZonePage.cancelButtonCss);
};

export const clickCancelButton = () => {
	clickButton(DangerZonePage.cancelButtonCss);
};

export const verifyDeleteButtonText = (text) => {
	verifyText(DangerZonePage.deleteButtonCss, text);
};
