import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyTextNotExisting,
	getLastElement,
	waitElementToHide,
	verifyValue
} from '../utils/util';
import { AddEmployeePositionPage } from '../pageobjects/AddEmployeePositionPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(AddEmployeePositionPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(AddEmployeePositionPage.gridButtonCss, index);
};

export const addNewPositionButtonVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.addNewPositionButtonCss);
};

export const clickAddNewPositionButton = () => {
	clickButton(AddEmployeePositionPage.addNewPositionButtonCss);
};

export const cancelNewPositionButtonVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const clickCancelNewPositionButton = () => {
	clickButton(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const newPositionInputVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.newPositionInputCss);
};

export const enterNewPositionData = (data) => {
	clickButton(AddEmployeePositionPage.newPositionInputCss);
	enterInput(AddEmployeePositionPage.newPositionInputCss, data);
};

export const tagsMultyselectVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.tagsSelectCss);
};

export const clickTagsMultyselect = () => {
	clickButton(AddEmployeePositionPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(AddEmployeePositionPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const savePositionButtonVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const clickSavePositionButton = () => {
	clickButton(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const editEmployeePositionButtonVisible = () => {
	verifyElementIsVisible(
		AddEmployeePositionPage.editEmployeePositionButtonCss
	);
};

export const clickEditEmployeePositionButton = () => {
	getLastElement(AddEmployeePositionPage.editEmployeePositionButtonCss);
};

export const editEmployeePositionInpuVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.editPositionInputCss);
};

export const enterEditPositionData = (data) => {
	clearField(AddEmployeePositionPage.editPositionInputCss);
	enterInput(AddEmployeePositionPage.editPositionInputCss, data);
};

export const deletePositionButtonVisible = () => {
	verifyElementIsVisible(
		AddEmployeePositionPage.removeEmployeePositionButtonCss
	);
};

export const clickDeletePositionButton = () => {
	getLastElement(AddEmployeePositionPage.removeEmployeePositionButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(
		AddEmployeePositionPage.confirmDeletePositionButtonCss
	);
};

export const clickConfirmDeletePositionButton = () => {
	clickButton(AddEmployeePositionPage.confirmDeletePositionButtonCss);
};

export const verifyTitleExists = (text) => {
	verifyValue(AddEmployeePositionPage.editPositionInputCss, text);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(AddEmployeePositionPage.verifyTextCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(AddEmployeePositionPage.toastrMessageCss);
};

export const cancelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.cancelButtonCss);
};

export const clickCancelButton = () => {
	clickButton(AddEmployeePositionPage.cancelButtonCss);
};
