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

export const addNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.addNewPositionButtonCss);
};

export const clickAddNewLevelButton = () => {
	clickButton(AddEmployeePositionPage.addNewPositionButtonCss);
};

export const cancelNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const clickCancelNewLevelButton = () => {
	clickButton(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const newLevelInputVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.newPositionInputCss);
};

export const enterNewLevelData = (data) => {
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

export const saveNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const clickSaveNewLevelButton = () => {
	clickButton(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const editEmployeeLevelButtonVisible = () => {
	verifyElementIsVisible(
		AddEmployeePositionPage.editEmployeePositionButtonCss
	);
};

export const clickEditEmployeeLevelButton = (index) => {
	clickButtonByIndex(
		AddEmployeePositionPage.editEmployeePositionButtonCss,
		index
	);
};

export const editEmployeeLevelInpuVisible = () => {
	verifyElementIsVisible(AddEmployeePositionPage.editPositionInputCss);
};

export const enterEditLevelData = (data) => {
	clearField(AddEmployeePositionPage.editPositionInputCss);
	enterInput(AddEmployeePositionPage.editPositionInputCss, data);
};

export const deleteLevelButtonVisible = () => {
	verifyElementIsVisible(
		AddEmployeePositionPage.removeEmployeePositionButtonCss
	);
};

export const clickDeleteLevelButton = (index) => {
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

export const clickConfirmDeleteLevelButton = () => {
	clickButton(AddEmployeePositionPage.confirmDeletePositionButtonCss);
};
