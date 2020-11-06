import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode
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
	clearField(AddEmployeePositionPage.newPositionInputCss);
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

export const clickEditEmployeePositionButton = (index) => {
	clickButtonByIndex(
		AddEmployeePositionPage.editEmployeePositionButtonCss,
		index
	);
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

export const clickDeletePositionButton = (index) => {
	clickButtonByIndex(
		AddEmployeePositionPage.removeEmployeePositionButtonCss,
		index
	);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(
		AddEmployeePositionPage.confirmDeletePositionButtonCss
	);
};

export const clickConfirmDeletePositionButton = () => {
	clickButton(AddEmployeePositionPage.confirmDeletePositionButtonCss);
};
