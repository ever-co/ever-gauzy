import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { AddEmployeeLevelPage } from '../pageobjects/AddEmployeeLevelPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(AddEmployeeLevelPage.gridButtonCss, index);
};

export const addNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const clickAddNewLevelButton = () => {
	clickButton(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const cancelNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const clickCancelNewLevelButton = () => {
	clickButton(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const newLevelInputVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.newLevelInputCss);
};

export const enterNewLevelData = (data) => {
	clearField(AddEmployeeLevelPage.newLevelInputCss);
	enterInput(AddEmployeeLevelPage.newLevelInputCss, data);
};

export const tagsMultyselectVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.tagsSelectCss);
};

export const clickTagsMultyselect = () => {
	clickButton(AddEmployeeLevelPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(AddEmployeeLevelPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.saveNewLevelButtonCss);
};

export const clickSaveNewLevelButton = () => {
	clickButton(AddEmployeeLevelPage.saveNewLevelButtonCss);
};

export const editEmployeeLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.editEmployeeLevelButtonCss);
};

export const clickEditEmployeeLevelButton = (index) => {
	clickButtonByIndex(AddEmployeeLevelPage.editEmployeeLevelButtonCss, index);
};

export const editEmployeeLevelInpuVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.editLevelInputCss);
};

export const enterEditLevelData = (data) => {
	clearField(AddEmployeeLevelPage.editLevelInputCss);
	enterInput(AddEmployeeLevelPage.editLevelInputCss, data);
};

export const deleteLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.removeEmployeeLevelButtonCss);
};

export const clickDeleteLevelButton = (index) => {
	clickButtonByIndex(
		AddEmployeeLevelPage.removeEmployeeLevelButtonCss,
		index
	);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};

export const clickConfirmDeleteLevelButton = () => {
	clickButton(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};
